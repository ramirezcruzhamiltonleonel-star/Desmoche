/** All k-sized combinations of `items`, order preserved within each combination. */
export function combinations<T>(items: T[], k: number): T[][] {
  if (k < 0 || k > items.length) return [];
  if (k === 0) return [[]];

  const result: T[][] = [];
  const combo: T[] = [];

  function backtrack(start: number): void {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]!);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return result;
}
