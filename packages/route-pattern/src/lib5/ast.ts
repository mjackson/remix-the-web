export type Span = [number, number];

export type Optional = { span: Span; type: 'optional'; items: Array<Param | Text> };
export type Param = { span: Span; type: 'param'; name: string };
export type Text = { span: Span; type: 'text'; text: string };

export type Part = Array<Optional | Param | Text>;

export type Pattern = {
  protocol: Part;
  hostname: Part;
  pathname: Part;
  search: string;
};

export function visit(
  part: Part,
  visitors: {
    optional?: (node: Optional) => void;
    param?: (node: Param, optional: Optional | null) => void;
    text?: (node: Text, optional: Optional | null) => void;
  },
) {
  for (const node of part) {
    if (node.type === 'text') {
      visitors.text?.(node, null);
      continue;
    }
    if (node.type === 'param') {
      visitors.param?.(node, null);
      continue;
    }
    if (node.type === 'optional') {
      visitors.optional?.(node);
      for (const item of node.items) {
        if (item.type === 'text') {
          visitors.text?.(item, node);
          continue;
        }
        if (item.type === 'param') {
          visitors.param?.(item, node);
          continue;
        }
      }
    }
  }
}
