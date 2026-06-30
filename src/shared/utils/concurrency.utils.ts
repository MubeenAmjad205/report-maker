/**
 * Runs an async mapper over `items` with at most `limit` operations in flight at once,
 * preserving input order in the returned results. Used to parallelize GitHub API calls
 * without tripping GitHub's secondary (concurrent-request) rate limits.
 */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  const poolSize = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: poolSize }, () => worker()));
  return results;
};

// Default concurrency for GitHub API fan-out. Conservative enough to stay clear of
// secondary rate limits while still cutting wall-clock time significantly.
export const GITHUB_API_CONCURRENCY = 6;
