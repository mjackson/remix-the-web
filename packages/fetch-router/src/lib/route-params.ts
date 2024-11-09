import { String } from 'ts-toolbelt';

type ParamName<T> = T extends `:${infer R}` ? (R extends `${string}?` ? never : R) : never;

export type HostnameParamName<T extends string> = ParamName<String.Split<T, '.'>[number]>;

export type PathnameParamName<T extends string> = ParamName<String.Split<T, '/'>[number]>;

// prettier-ignore
type OptionalParamName<T> =
  T extends '*' ? T :
  T extends `:${infer R}` ?
    R extends `${infer L}?` ? L :
    never :
  never;

export type OptionalHostnameParamName<T extends string> = OptionalParamName<
  String.Split<T, '.'>[number]
>;

export type OptionalPathnameParamName<T extends string> = OptionalParamName<
  String.Split<T, '/'>[number]
>;

// prettier-ignore
export type SearchParamName<T extends string> =
  T extends '' ? never :
  T extends `?${infer R}` ? SearchParamName_<R> :
  SearchParamName_<T>

type SearchParamName_<T extends string> = SearchPairName<String.Split<T, '&'>[number]>;

// prettier-ignore
type SearchPairName<T extends string> =
  T extends '' ? never :
  T extends `${infer L}=${string}` ?
    L extends '' ? never : L :
	T
