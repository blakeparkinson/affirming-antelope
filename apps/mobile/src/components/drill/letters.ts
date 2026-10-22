/** Choice letters, A to E. */
export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** "C", "B and D", "A, B and D": the targets a miss points to. */
export function letterList(indexes: number[]): string {
  const ls = indexes.map((i) => LETTERS[i]);
  return ls.length < 2 ? (ls[0] ?? '') : `${ls.slice(0, -1).join(', ')} and ${ls[ls.length - 1]}`;
}
