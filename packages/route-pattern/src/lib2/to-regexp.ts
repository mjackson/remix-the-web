import { extractHostname, extractPathname, extractProtocol } from '../lib/route-pattern-helpers.ts';

// TODO:
// - [ ] handle `*` params (anywhere in hostname or pathname)

const identifierRE = /[a-zA-Z_$][\w$]*/;
const paramNameRE = new RegExp('^:(' + identifierRE.source + ')');
const escape = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// TODO: handle ambiguous/bad params more gracefully
const ambiguousParamNameRE = new RegExp(':(' + identifierRE.source + ')' + /\)(?:([\w$]+))/.source);

export function toRegExp(pattern: string) {
  const badPattern = ambiguousParamNameRE.exec(pattern);
  if (badPattern) {
    throw new Error(`Bad pattern: ${pattern} due to ':${badPattern[1]})${badPattern[2]}'`);
  }

  const _protocol = parse(extractProtocol(pattern), [parseOptionals()]);
  const protocol = (_protocol === '' ? '\\w+:' : _protocol) + '//';

  const paramNames: Array<string> = [];
  const hostname = parse(extractHostname(pattern), [
    parseOptionals(),
    parseParams((p) => paramNames.push(p)),
  ]);
  const pathname = parse(extractPathname(pattern), [
    parseOptionals(),
    parseParams((p) => paramNames.push(p)),
  ]);
  return {
    regexp: new RegExp('^' + protocol + hostname + pathname + '$'),
    paramNames,
  };
}

type Parser = (text: string, index: number) => { result: string; index: number } | null;

const parse = (text: string, parsers: Array<Parser> = []) => {
  let source = '';
  let i = 0;
  iter: while (i < text.length) {
    for (const parser of parsers) {
      const parsed = parser(text, i);
      if (parsed) {
        source += parsed.result;
        i = parsed.index;
        continue iter;
      }
    }
    source += escape(text[i]);
    i += 1;
  }
  return source;
};

const parseOptionals = (): Parser => {
  const stack: Array<number> = [];
  return (text, index) => {
    const char = text[index];
    if (char === '(') {
      if (stack.length > 0) throw new Error('Nested parens');
      stack.push(index);
      return {
        result: '(?:',
        index: index + 1,
      };
    }
    if (char === ')') {
      if (stack.length === 0) throw new Error('Unmatched close parens');
      stack.pop();
      return {
        result: ')?',
        index: index + 1,
      };
    }
    if (index === text.length && stack.length > 0) {
      throw new Error('Unmatched open paren');
    }
    return null;
  };
};

const parseParams = (callback: (paramName: string) => void): Parser => {
  return (text, index) => {
    const match = paramNameRE.exec(text.slice(index));
    if (!match) return null;
    const paramName = match[1];
    callback(paramName);
    return {
      result: '(\\w+)',
      index: index + match[0].length,
    };
  };
};
