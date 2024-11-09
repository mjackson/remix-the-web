import { Assert, Equal } from './spec-helpers.js';

import { Params } from './params.js';
import { ParamsString, SearchParamsString } from './params-string.js';
import { SearchParams } from './search-params.js';

type ParamsStringSpec = [
  Assert<Equal<ParamsString<Params>, '/'>>,
  Assert<Equal<ParamsString<Params<never, never>>, '/'>>,
  Assert<Equal<ParamsString<Params<'id'>>, '/:id'>>,
  Assert<Equal<ParamsString<Params<'id' | 'name'>>, '/:id/:name'>>,
  Assert<Equal<ParamsString<Params<'id', 'name' | 'age'>>, '/:id/:name?/:age?'>>,
  Assert<Equal<ParamsString<Params<'id' | 'name', 'age'>>, '/:id/:name/:age?'>>,
];

type SearchParamsStringSpec = [
  Assert<Equal<SearchParamsString<SearchParams>, ''>>,
  Assert<Equal<SearchParamsString<SearchParams<never>>, ''>>,
  Assert<Equal<SearchParamsString<SearchParams<'q'>>, '?q'>>,
  Assert<Equal<SearchParamsString<SearchParams<'q' | 'p'>>, '?q&p'>>,
];
