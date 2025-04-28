import { ParseError } from './parse-error.ts';
import { PartPattern, type PartVariant } from './part-pattern.ts';
import { splitIntoSpans, type Span } from './utils/split.ts';

type Parts = {
  protocol?: PartPattern;
  hostname?: PartPattern;
  pathname?: PartPattern;
  search?: string;
};

export type RouteVariant = {
  protocol?: string;
  hostname?: PartVariant;
  pathname?: PartVariant;
};

export class RoutePattern {
  #protocol?: PartPattern;
  #hostname?: PartPattern;
  #pathname?: PartPattern;
  #search?: string;

  private constructor({ protocol, hostname, pathname, search }: Parts) {
    this.#protocol = protocol;
    this.#hostname = hostname;
    this.#pathname = pathname;
    this.#search = search;
  }

  static parse(source: string): RoutePattern {
    const parts = splitIntoSpans(source);

    return new RoutePattern({
      protocol: parts.protocol && parseProtocol(source, parts.protocol),
      hostname: parts.hostname && parseHostname(source, parts.hostname),
      pathname: parts.pathname && parsePathname(source, parts.pathname),
      search: parts.search && source.slice(...parts.search),
    });
  }

  get protocol(): string {
    return this.#protocol?.source ?? '';
  }

  get hostname(): string {
    return this.#hostname?.source ?? '';
  }

  get pathname(): string {
    const source = this.#pathname?.source;
    if (source === undefined) return '/';
    return '/' + source;
  }

  get search(): string {
    return this.#search ?? '';
  }

  get source(): string {
    if (this.protocol !== '' || this.hostname !== '') {
      return this.protocol + '://' + this.hostname + this.pathname + this.search;
    }
    return this.pathname + this.search;
  }

  toString() {
    return `RoutePattern[${this.source}]`;
  }

  join(other: RoutePattern): RoutePattern {
    const protocol = other.#protocol ?? this.#protocol;
    const hostname = other.#hostname ?? this.#hostname;

    // pathname
    let pathnameSource: string = '';
    if (this.#pathname) {
      pathnameSource += this.#pathname.source;
    }
    if (other.#pathname) {
      if (pathnameSource) pathnameSource += '/';
      pathnameSource += other.#pathname.source;
    }
    const pathname = pathnameSource !== '' ? PartPattern.parse(pathnameSource) : undefined;
    if (pathname instanceof ParseError) {
      let offset = 0;
      if (protocol) offset += protocol.source.length;
      // `://<hostname>/`
      if (hostname) offset += 3 + hostname.source.length + 1;
      throw pathname.offset(offset);
    }

    return new RoutePattern({
      protocol,
      hostname,
      pathname,
      search: other.#search ?? this.#search, // todo
    });
  }

  *variants(): Generator<RouteVariant> {
    for (const protocol of this.#protocol?.variants() ?? [undefined]) {
      for (const hostname of this.#hostname?.variants() ?? [undefined]) {
        for (const pathname of this.#pathname?.variants() ?? [undefined]) {
          yield {
            protocol: protocol?.source,
            hostname,
            pathname,
          };
        }
      }
    }
  }
}

function parseProtocol(source: string, span: Span) {
  const parsed = PartPattern.parse(source.slice(...span));
  if (parsed instanceof ParseError) {
    throw parsed.offset(span[0]);
  }
  parsed.traverse({
    param: (node) => {
      throw new ParseError('param-in-protocol', node.span);
    },
    glob: (node) => {
      throw new ParseError('glob-in-protocol', node.span);
    },
  });
  return parsed;
}

function parseHostname(source: string, span: Span) {
  const parsed = PartPattern.parse(source.slice(...span));
  if (parsed instanceof ParseError) {
    throw parsed.offset(span[0]);
  }
  parsed.traverse({
    glob: (node, path) => {
      const [ast, optional] = path;
      if (optional) {
        if (optional.node.items.length === 1) throw new Error('todo no (*)');
        const isAtStart = optional.index === 0;
        if (!isAtStart) {
          throw new ParseError('glob-not-at-start-of-hostname', node.span).offset(span[0]);
        }
      }
      const isAtStart = ast.index === 0;
      if (!isAtStart) {
        throw new ParseError('glob-not-at-start-of-hostname', node.span).offset(span[0]);
      }
    },
  });
  return parsed;
}

function parsePathname(source: string, span: Span) {
  const parsed = PartPattern.parse(source.slice(...span));
  if (parsed instanceof ParseError) {
    throw parsed.offset(span[0]);
  }
  parsed.traverse({
    glob: (node, path) => {
      const [ast, optional] = path;
      if (optional) {
        if (optional.node.items.length === 1) throw new Error('todo no (*)');
        const isAtEnd = optional.index === optional.node.items.length - 1;
        if (!isAtEnd) {
          throw new ParseError('glob-not-at-end-of-pathname', node.span).offset(span[0]);
        }
      }
      const isAtEnd = ast.index === ast.node.length - 1;
      if (!isAtEnd) {
        throw new ParseError('glob-not-at-end-of-pathname', node.span).offset(span[0]);
      }
    },
  });
  return parsed;
}
