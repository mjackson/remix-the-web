export function sortByStaticLengths(a: string, b: string) {
  const lengthsA = getStaticLengths(a);
  const lengthsB = getStaticLengths(b);

  for (let i = 0; i < Math.max(lengthsA.length, lengthsB.length); i++) {
    const lenA = lengthsA[i] ?? 0;
    const lenB = lengthsB[i] ?? 0;

    if (lenA !== lenB) return lenB - lenA;
  }
  return 0;
}

function getStaticLengths(pattern: string): Array<number> {
  return pattern.split(':').map((x) => x.length);
}
