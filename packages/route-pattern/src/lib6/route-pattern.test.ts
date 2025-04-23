import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { RoutePattern } from './route-pattern.ts';
import { ParseError } from './errors.ts';

describe('RoutePattern', () => {
  describe('parse', () => {
    it('errors on unmatched parens', () => {
      assert.throws(
        () => RoutePattern.parse('htt(ps://:sub.remix.run/products/:id'),
        //                        012^
        new ParseError('paren-unmatched', [3, 4]),
      );
      assert.throws(
        () => RoutePattern.parse('https://(:sub.remix.run/products/:id'),
        //                        01234567^
        new ParseError('paren-unmatched', [8, 9]),
      );
      assert.throws(
        () => RoutePattern.parse('https://:sub.remix.run/products(/:id'),
        //                        0123456789 123456789 123456789 ^
        new ParseError('paren-unmatched', [31, 32]),
      );
    });

    it('errors on nested parens', () => {
      assert.throws(
        () => RoutePattern.parse('htt(p(s://:sub.remix.run/products/:id'),
        //                        01234^
        new ParseError('paren-nested', [5, 6]),
      );
      assert.throws(
        () => RoutePattern.parse('https://(:sub.(remix.run/products/:id'),
        //                        0123456789 123^
        new ParseError('paren-nested', [14, 15]),
      );
      assert.throws(
        () => RoutePattern.parse('https://:sub.remix.run/(products(/:id'),
        //                        0123456789 123456789 123456789 1^
        new ParseError('paren-nested', [32, 33]),
      );
    });

    it('errors on params in protocol', () => {
      assert.throws(
        () => RoutePattern.parse('http:s://:sub.remix.run'),
        //                        0123^^
        new ParseError('param-in-protocol', [4, 6]),
      );
    });
    it('errors on missing param names in hostname and pathname', () => {});

    it('errors on globs in protocol', () => {});
    it('errors on missing glob names in hostname and pathname', () => {});
    it('errors on glob in hostname if not at start of hostname', () => {});
    it('errors on glob in pathname if not at end of pathname', () => {});
  });

  describe('source', () => {});

  describe('join', () => {
    // todo
  });
});
