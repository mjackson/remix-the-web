import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Assert, Equal } from '../../test/utils.ts';

import { joinRoutePatternParts } from './route-pattern-parts.ts';
import type { JoinRoutePatternParts } from './route-pattern-parts.ts';

describe('joinRoutePatternParts', () => {
  it('joins route pattern parts correctly', () => {
    assert.equal(
      joinRoutePatternParts({ protocol: '', hostname: '', pathname: '/', search: '' }),
      '/',
    );
    assert.equal(
      joinRoutePatternParts({ protocol: '', hostname: '', pathname: '/', search: '?q' }),
      '/?q',
    );
    assert.equal(
      joinRoutePatternParts({ protocol: '', hostname: 'remix.run', pathname: '/', search: '' }),
      '://remix.run/',
    );
    assert.equal(
      joinRoutePatternParts({
        protocol: 'https:',
        hostname: 'remix.run',
        pathname: '/',
        search: '',
      }),
      'https://remix.run/',
    );
    assert.equal(
      joinRoutePatternParts({
        protocol: 'https:',
        hostname: 'remix.run',
        pathname: '/',
        search: '?q',
      }),
      'https://remix.run/?q',
    );
  });
});

type JoinRoutePatternPartsSpec = [
  Assert<
    Equal<JoinRoutePatternParts<{ protocol: ''; hostname: ''; pathname: '/'; search: '' }>, '/'>
  >,
  Assert<
    Equal<JoinRoutePatternParts<{ protocol: ''; hostname: ''; pathname: '/'; search: '?q' }>, '/?q'>
  >,
  Assert<
    Equal<
      JoinRoutePatternParts<{ protocol: ''; hostname: 'remix.run'; pathname: '/'; search: '' }>,
      '://remix.run/'
    >
  >,
  Assert<
    Equal<
      JoinRoutePatternParts<{
        protocol: 'https:';
        hostname: 'remix.run';
        pathname: '/';
        search: '';
      }>,
      'https://remix.run/'
    >
  >,
  Assert<
    Equal<
      JoinRoutePatternParts<{
        protocol: 'https:';
        hostname: 'remix.run';
        pathname: '/';
        search: '?q';
      }>,
      'https://remix.run/?q'
    >
  >,
];
