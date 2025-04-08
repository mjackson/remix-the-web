export type Optional = { type: 'optional'; items: Array<Param | Text> };
export type Param = { type: 'param'; name: string };
export type Text = { type: 'text'; text: string };

export type Part = Array<Optional | Param | Text>;

export type Pattern = {
  protocol: Part;
  hostname: Part;
  pathname: Part;
  search: string;
};

export function traverse(
  part: Part,
  visit: {
    optionalOpen?: (node: Optional) => void;
    optionalClose?: (node: Optional) => void;
    param?: (node: Param, optional: Optional | null) => void;
    text?: (node: Text, optional: Optional | null) => void;
  },
) {
  for (const node of part) {
    if (node.type === 'text') {
      visit.text?.(node, null);
      continue;
    }
    if (node.type === 'param') {
      visit.param?.(node, null);
      continue;
    }
    if (node.type === 'optional') {
      visit.optionalOpen?.(node);
      for (const item of node.items) {
        if (item.type === 'text') {
          visit.text?.(item, node);
          continue;
        }
        if (item.type === 'param') {
          visit.param?.(item, node);
          continue;
        }
      }
      visit.optionalClose?.(node);
    }
  }
}
