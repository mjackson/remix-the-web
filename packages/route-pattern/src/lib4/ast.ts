export type Optional<T> = {
  type: 'optional';
  option: T;
};
export type Separator = {
  type: 'separator';
};
export type Param = {
  type: 'param';
  name: string;
};
export type Text = {
  type: 'text';
  text: string;
};

export type Protocol = Array<Optional<Text> | Text>;

type HostnameContent = Param | Separator | Text;
export type Hostname = Array<Optional<Array<HostnameContent>> | HostnameContent>;

type PathnameContent = Param | Separator | Text;
export type Pathname = Array<Optional<Array<PathnameContent>> | PathnameContent>;

export type Pattern = {
  protocol: Protocol;
  hostname: Hostname;
  pathname: Pathname;
};
