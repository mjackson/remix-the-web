import * as assert from 'node:assert';
import { describe, it } from 'node:test';

import { PartPattern } from './part-pattern.ts';
import { ParseError } from './parse-error.ts';

describe('PartPattern', () => {
  describe('parse', () => {
    it('errors on unmatched parens', () => {
      assert.deepStrictEqual(
        PartPattern.parse('the-quick-(brown'),
        //                 0123456789^
        new ParseError('paren-unmatched', [10, 11]),
      );
      assert.deepStrictEqual(
        PartPattern.parse('the-quick)-brown'),
        //                 012345678^
        new ParseError('paren-unmatched', [9, 10]),
      );
    });

    it('errors on nested parens', () => {
      assert.deepStrictEqual(
        PartPattern.parse('the-(quick-(brown)'),
        //                 0123456789 ^
        new ParseError('paren-nested', [11, 12]),
      );
    });

    it('errors on missing param name', () => {
      assert.deepStrictEqual(
        PartPattern.parse('the-:-brown'),
        //                 0123^
        new ParseError('param-missing-name', [4, 5]),
      );
    });

    it('throws on missing glob name', () => {
      assert.deepStrictEqual(
        PartPattern.parse('the-*-brown'),
        //                 0123^
        new ParseError('glob-missing-name', [4, 5]),
      );
    });
  });

  describe('source', () => {
    it('matches the input', () => {
      const input = 'the-:quick-*brown-(fox-:jumps-over-*the-lazy)-dog';
      const pattern = PartPattern.parse(input);
      if (pattern instanceof ParseError) throw pattern;
      assert.deepStrictEqual(pattern.source, input);
    });
  });

  describe('variants', () => {
    it('generates all variants', () => {
      const input = 'the-(:quick-)*brown-(fox-):jumps-(over-*the-lazy-)dog';
      const pattern = PartPattern.parse(input);
      if (pattern instanceof ParseError) throw pattern;
      const variants = Array.from(pattern.variants());
      assert.deepStrictEqual(variants, [
        {
          source: 'the-*-:-dog',
          paramSlots: [
            ['quick', false],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', false],
          ],
        },
        {
          source: 'the-:-*-:-dog',
          paramSlots: [
            ['quick', true],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', false],
          ],
        },
        {
          source: 'the-*-fox-:-dog',
          paramSlots: [
            ['quick', false],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', false],
          ],
        },
        {
          source: 'the-:-*-fox-:-dog',
          paramSlots: [
            ['quick', true],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', false],
          ],
        },

        {
          source: 'the-*-:-over-*-lazy-dog',
          paramSlots: [
            ['quick', false],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', true],
          ],
        },
        {
          source: 'the-:-*-:-over-*-lazy-dog',
          paramSlots: [
            ['quick', true],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', true],
          ],
        },
        {
          source: 'the-*-fox-:-over-*-lazy-dog',
          paramSlots: [
            ['quick', false],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', true],
          ],
        },
        {
          source: 'the-:-*-fox-:-over-*-lazy-dog',
          paramSlots: [
            ['quick', true],
            ['jumps', true],
          ],
          globSlots: [
            ['brown', true],
            ['the', true],
          ],
        },
      ]);
    });
  });
});
