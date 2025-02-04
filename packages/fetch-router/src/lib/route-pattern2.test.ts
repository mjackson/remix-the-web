import type { Assert, Equal } from '../../test/utils.ts';

import type { RoutePattern, RoutePatternJoin, RoutePatternString } from './route-pattern2.ts';

// prettier-ignore
type RoutePatternSpec = [
  Assert<Equal<RoutePattern<''>, { protocol: '', hostname: '', pathname: '/', search: '' }>>,
  Assert<Equal<RoutePattern<'/'>, { protocol: '', hostname: '', pathname: '/', search: '' }>>,
  Assert<Equal<RoutePattern<'https://remix.run'>, { protocol: 'https:', hostname: 'remix.run', pathname: '/', search: '' }>>,
  Assert<Equal<RoutePattern<'https://remix.run/'>, { protocol: 'https:', hostname: 'remix.run', pathname: '/', search: '' }>>,
  Assert<Equal<RoutePattern<'https://remix.run/path'>, { protocol: 'https:', hostname: 'remix.run', pathname: '/path', search: '' }>>,
  Assert<Equal<RoutePattern<'https://remix.run/path?q'>, { protocol: 'https:', hostname: 'remix.run', pathname: '/path', search: '?q' }>>,
  Assert<Equal<RoutePattern<'https://remix.run?'>, { protocol: 'https:', hostname: 'remix.run?', pathname: '/', search: '' }>>,
  Assert<Equal<RoutePattern<'https://remix.run/?'>, { protocol: 'https:', hostname: 'remix.run', pathname: '/', search: '?' }>>,
  Assert<Equal<RoutePattern<'https://remix.run/?q'>, { protocol: 'https:', hostname: 'remix.run', pathname: '/', search: '?q' }>>,
];

// prettier-ignore
type RoutePatternJoinSpec = [
  Assert<Equal<RoutePatternJoin<'', ''>, '/'>>,
  Assert<Equal<RoutePatternJoin<'/', ''>, '/'>>,
  Assert<Equal<RoutePatternJoin<'', '/'>, '/'>>,
  Assert<Equal<RoutePatternJoin<'/', '/'>, '/'>>,
  Assert<Equal<RoutePatternJoin<'?', ''>, '/?'>>,
  Assert<Equal<RoutePatternJoin<'/', '?'>, '/?'>>,
  Assert<Equal<RoutePatternJoin<'/path', '?q'>, '/path?q'>>,
  Assert<Equal<RoutePatternJoin<'?a', '?b'>, '/?a&b'>>,
  Assert<Equal<RoutePatternJoin<'https://remix.run', ''>, 'https://remix.run/'>>,
  Assert<Equal<RoutePatternJoin<'https://remix.run/', ''>, 'https://remix.run/'>>,
  Assert<Equal<RoutePatternJoin<'https://remix.run/', '/path'>, 'https://remix.run/path'>>,
  Assert<Equal<RoutePatternJoin<'https://remix.run/?q', '/path'>, 'https://remix.run/path?q'>>,
]

// prettier-ignore
type RoutePatternStringSpec = [
  Assert<Equal<RoutePatternString<{ protocol: '', hostname: '', pathname: '/', search: '' }>, '/'>>,
  Assert<Equal<RoutePatternString<{ protocol: 'https:', hostname: '', pathname: '/', search: '' }>, '/'>>,
  Assert<Equal<RoutePatternString<{ protocol: '', hostname: 'remix.run', pathname: '/', search: '' }>, '://remix.run/'>>,
  Assert<Equal<RoutePatternString<{ protocol: 'https:', hostname: 'remix.run', pathname: '/', search: '' }>, 'https://remix.run/'>>,
];
