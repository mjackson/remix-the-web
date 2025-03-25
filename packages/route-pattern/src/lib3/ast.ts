export type Span = [beginIndex: number, endIndex: number];

export type Optional = { type: 'optional'; option: Array<Param | Separator | Text>; span: Span };
type Param = { type: 'param'; name: string; span: Span };
type Text = { type: 'text'; text: string; span: Span };
type Separator = { type: 'separator'; span: Span };
export type Part = Array<Optional | Param | Separator | Text>;

export type PartName = 'protocol' | 'hostname' | 'pathname' | 'search';

export type Pattern = Partial<Record<PartName, Part>>;
