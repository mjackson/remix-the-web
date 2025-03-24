import * as AST from './ast.ts';

const escape = (source: string) => source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function toRegExp(ast: AST.Pattern) {
  const paramNames: Array<string> = [];

  let source = '';
  source += ast.protocol === undefined ? '\\w+' : partToRegExp(ast.protocol);
  source += escape('://');
  source +=
    ast.hostname === undefined
      ? /[^/]*/
      : partToRegExp(ast.hostname, (param) => paramNames.push(param.name));

  if (ast.pathname) {
    source += escape('/');
    source += partToRegExp(ast.pathname, (param) => paramNames.push(param.name));
  }
  return { regexp: new RegExp('^' + source + '$'), paramNames };

  // TODO search
  // if (ast.search) {
  //   source += escape('?');
  //   source += ast.search === undefined ? /.*/ : partToRegExp(ast.search); // TODO
  // }
}

function partToRegExp(part: AST.Part, onParam?: (param: AST.Param) => void) {
  let source = '';

  for (const item of part) {
    if (item.type === 'optional') {
      source += '(?:';
      for (const optionItem of item.option) {
        if (optionItem.type === 'param') {
          source += '(\\w+)';
          onParam?.(optionItem);
          continue;
        }
        if (optionItem.type === 'text') {
          source += escape(optionItem.text);
          continue;
        }
      }
      source += ')?';
      continue;
    }
    if (item.type === 'param') {
      source += '(\\w+)';
      onParam?.(item);
      continue;
    }
    if (item.type === 'text') {
      source += escape(item.text);
      continue;
    }
  }
  return source;
}
