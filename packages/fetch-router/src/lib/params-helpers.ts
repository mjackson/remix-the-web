import { String } from 'ts-toolbelt';

type RequiredParamName<T> = T extends `:${infer R}` ? (R extends `${string}?` ? never : R) : never;
type OptionalParamName<T> = T extends `:${infer R}` ? (R extends `${infer L}?` ? L : never) : never;

export type RequiredHostnameParamName<T extends string> = RequiredParamName<
  String.Split<T, '.'>[number]
>;

export type OptionalHostnameParamName<T extends string> = OptionalParamName<
  String.Split<T, '.'>[number]
>;

export type RequiredPathnameParamName<T extends string> = RequiredParamName<
  String.Split<T, '/'>[number]
>;

export type OptionalPathnameParamName<T extends string> = OptionalParamName<
  String.Split<T, '/'>[number]
>;

// prettier-ignore
export type SearchParamName<T extends string> =
  T extends `` ? never :
  T extends `?${infer R}` ? SearchParamName_<R> :
  SearchParamName_<T>

type SearchParamName_<T extends string> = SearchPairName<String.Split<T, '&'>[number]>;

// prettier-ignore
type SearchPairName<T extends string> =
  T extends `` ? never :
  T extends `${infer L}=${string}` ?
    L extends `` ? never : L :
	T
