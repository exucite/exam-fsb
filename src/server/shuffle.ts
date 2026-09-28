/**
 * Cryptographic Fisher-Yates shuffle. Order of questions is never shuffled —
 * only the options within a question, on every new attempt.
 */
export function shuffle<T>(input: readonly T[], rand: () => number = Math.random): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** Uniform random source backed by Web Crypto, for server use. */
export function cryptoRandom(): () => number {
  const buffer = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buffer);
    return buffer[0]! / 2 ** 32;
  };
}
