export type Span = [beginIndex: number, endIndex: number];

export type Optional = { type: 'optional'; option: Array<Param | Separator | Text>; span: Span };
export type Param = { type: 'param'; name: string; span: Span };
export type Text = { type: 'text'; text: string; span: Span };
export type Separator = { type: 'separator'; span: Span };
export type Part = Array<Optional | Param | Separator | Text>;

export type PartName = 'protocol' | 'hostname' | 'pathname' | 'search';

export type Pattern = Partial<Record<PartName, Part>>;
