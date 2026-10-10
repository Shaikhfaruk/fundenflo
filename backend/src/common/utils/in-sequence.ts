export async function mapInSequence<T, R>(items: Iterable<T>, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) results.push(await run(item));
  return results;
}
