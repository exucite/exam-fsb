import { describe, it, expect } from 'vitest';
import { shuffle, cryptoRandom } from '@/server/shuffle';

describe('shuffle', () => {
  it('shuffles array', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle(arr, Math.random);
    expect(shuffled).toHaveLength(5);
    expect(new Set(shuffled)).toEqual(new Set(arr));
  });

  it('does not mutate original', () => {
    const original = [1, 2, 3];
    const copy = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  it('handles empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('handles seeded randomness', () => {
    let counter = 0;
    const seeded = (): number => {
      const values = [0.1, 0.5, 0.9, 0.3, 0.7];
      return values[counter++ % values.length]!;
    };
    const result1 = shuffle([1, 2, 3, 4, 5], seeded);
    counter = 0;
    const result2 = shuffle([1, 2, 3, 4, 5], seeded);
    expect(result1).toEqual(result2);
  });

  it('cryptoRandom produces values in [0, 1)', () => {
    const rand = cryptoRandom();
    for (let i = 0; i < 100; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
