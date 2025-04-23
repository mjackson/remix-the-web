import { ParseError } from './errors.ts';

type Span = [number, number];
type Param = { type: 'param'; name: string; span: Span };
type Glob = { type: 'glob'; name: string; span: Span };
type Text = { type: 'text'; content: string; span: Span };
type Optional = { type: 'optional'; items: Array<Param | Glob | Text>; span: Span };
type Ast = Array<Optional | Param | Glob | Text>;

type Path =
  | [{ node: Ast; index: number }]
  | [{ node: Ast; index: number }, { node: Optional; index: number }];

type Slots = Array<[string, boolean]>;
export type Variant = {
  source: string;
  paramSlots: Slots;
  globSlots: Slots;
};

const textRE = /^[^():*]+/;
const identifierRE = /^[a-zA-Z_$][\w$]*/;

export class PartPattern {
  #source: string;
  #ast: Ast;

  private constructor(source: string, ast: Ast) {
    this.#source = source;
    this.#ast = ast;
  }

  get source(): string {
    return this.#source;
  }

  static parse(source: string): PartPattern | ParseError {
    const ast: Ast = [];

    let optional: Optional | null = null;

    let i = 0;
    while (i < source.length) {
      const char = source[i];

      // optional
      if (char === '(') {
        const span: [number, number] = [i, i + 1];
        if (optional) return new ParseError('paren-nested', span);
        optional = { type: 'optional', items: [], span };
        i += 1;
        continue;
      }
      if (char === ')') {
        if (!optional) return new ParseError('paren-unmatched', [i, i + 1]);
        optional.span[1] = i + 1;
        ast.push(optional);
        optional = null;
        i += 1;
        continue;
      }

      // param
      if (char === ':') {
        const match = identifierRE.exec(source.slice(i + 1));
        if (!match) return new ParseError('param-missing-name', [i, i + 1]);
        const name = match[0];
        const node: Param = { type: 'param', name, span: [i, i + 1 + name.length] };
        (optional ? optional.items : ast).push(node);
        i += 1 + name.length;
        continue;
      }

      // glob
      if (char === '*') {
        const match = identifierRE.exec(source.slice(i + 1));
        if (!match) return new ParseError('glob-missing-name', [i, i + 1]);
        const name = match[0];
        const node: Glob = { type: 'glob', name, span: [i, i + 1 + name.length] };
        (optional ? optional.items : ast).push(node);
        i += 1 + name.length;
        continue;
      }

      // text
      const match = textRE.exec(source.slice(i));
      if (!match) throw new Error('todo');
      const content = match[0];
      const node: Text = { type: 'text', content, span: [i, i + content.length] };
      (optional ? optional.items : ast).push(node);
      i += content.length;
    }
    if (optional) return new ParseError('paren-unmatched', optional.span);
    return new PartPattern(source, ast);
  }

  traverse(visit: {
    optionalOpen?: (node: Optional, path: Path) => void;
    optionalClose?: (node: Optional, Path: Path) => void;
    param?: (node: Param, path: Path) => void;
    glob?: (node: Glob, path: Path) => void;
    text?: (node: Text, path: Path) => void;
  }): void {
    for (let i = 0; i < this.#ast.length; i++) {
      const path: Path = [{ node: this.#ast, index: i }];
      const node = this.#ast[i];
      if (node.type == 'param') visit.param?.(node, path);
      if (node.type == 'glob') visit.glob?.(node, path);
      if (node.type == 'text') visit.text?.(node, path);

      if (node.type === 'optional') {
        visit.optionalOpen?.(node, path);
        for (let j = 0; j < node.items.length; j++) {
          const item = node.items[j];
          const itemPath: Path = [...path, { node, index: j }];
          if (item.type == 'param') visit.param?.(item, itemPath);
          if (item.type == 'glob') visit.glob?.(item, itemPath);
          if (item.type == 'text') visit.text?.(item, itemPath);
        }
        visit.optionalClose?.(node, path);
      }
    }
  }

  *variants(): Generator<Variant> {
    let numOptionals = 0;
    this.traverse({
      optionalOpen: () => (numOptionals += 1),
    });

    const max = 2 ** numOptionals;
    for (let state = 0; state < max; state++) {
      const paramSlots: Variant['paramSlots'] = [];
      const globSlots: Variant['globSlots'] = [];

      let optionalIndex = 0;
      const shouldInclude = (path: Path) => {
        const optional = path[1];
        if (!optional) return true;
        return Boolean(state & (1 << optionalIndex));
      };

      let source = '';
      this.traverse({
        optionalClose: () => (optionalIndex += 1),
        text: (node, path) => {
          if (shouldInclude(path)) source += node.content;
        },
        param: (node, path) => {
          const include = shouldInclude(path);
          if (include) source += ':';
          paramSlots.push([node.name, include]);
        },
        glob: (node, path) => {
          const include = shouldInclude(path);
          if (include) source += '*';
          globSlots.push([node.name, include]);
        },
      });

      yield { source, paramSlots, globSlots };
    }
  }
}
