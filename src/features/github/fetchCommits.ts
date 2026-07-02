import axios from 'axios';
import { GithubCommit } from '../../shared/types/global.types';
import { mapWithConcurrency, GITHUB_API_CONCURRENCY } from '../../shared/utils/concurrency.utils';

export const fetchTodayCommits = async (
  token: string,
  username: string,
  since: string
): Promise<GithubCommit[]> => {
  const commitsMap = new Map<string, GithubCommit>();
  const sinceDate = new Date(since);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  // 1. Fetch from Events API (up to 3 pages) to heavily guarantee we catch non-default branches
  for (let page = 1; page <= 3; page++) {
    try {
      const eventsRes = await axios.get(`https://api.github.com/users/${username}/events`, {
        headers,
        params: { per_page: 100, page },
      });

      const events = eventsRes.data || [];
      if (events.length === 0) break;

      for (const event of events) {
        if (event.type === 'PushEvent') {
          const eventDate = new Date(event.created_at);
          if (eventDate >= sinceDate) {
            const repoName = event.repo.name;
            for (const commit of event.payload.commits || []) {
              const key = `${repoName}-${commit.sha}`;
              if (!commitsMap.has(key)) {
                commitsMap.set(key, {
                  repoName,
                  message: commit.message,
                  date: event.created_at,
                  authorName: commit.author?.name || username,
                  codeDiff: commit.url, // Temporarily store URL, we'll fetch the code below
                  commitUrl: `https://github.com/${repoName}/commit/${commit.sha}`,
                });
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.warn(`Events API page ${page} encountered an error:`, error.response?.data || error.message);
      break;
    }
  }

  // 2. Fallback to Search API (in case events missed something, but search API lacks branch support)
  try {
    const todayDateStr = since.split('T')[0];
    const query = `author:${username} committer-date:>=${todayDateStr}`;
    const searchRes = await axios.get(`https://api.github.com/search/commits`, {
      headers,
      params: { q: query, per_page: 100, sort: 'author-date', order: 'desc' },
    });

    const items = searchRes.data.items || [];
    for (const item of items) {
      const repoName = item.repository.full_name;
      const key = `${repoName}-${item.sha}`;
      if (!commitsMap.has(key)) {
        commitsMap.set(key, {
          repoName,
          message: item.commit.message,
          date: item.commit.author.date,
          authorName: item.commit.author.name,
          codeDiff: item.url,
          commitUrl: item.html_url,
        });
      }
    }
  } catch (error: any) {
    console.warn('Search API encountered an error:', error.response?.data || error.message);
  }

  // 3. Ultimate Fallback: Direct Repo & Branch Scanning (Guarantees we don't miss ANY branch on any accessible repo pushed today)
  try {
    // Get repositories the user has access to, sorted by most recently pushed
    const reposRes = await axios.get(`https://api.github.com/user/repos`, {
      headers,
      params: { sort: 'pushed', direction: 'desc', per_page: 20 },
    });

    // Only scan repos actually pushed today; parallelize across repos with a bounded pool.
    // (Branches within a repo stay sequential so total in-flight requests stay capped.)
    const reposPushedToday = (reposRes.data || []).filter(
      (repo: any) => new Date(repo.pushed_at) >= sinceDate
    );

    await mapWithConcurrency(reposPushedToday, GITHUB_API_CONCURRENCY, async (repo: any) => {
      const repoName = repo.full_name;
      // Fetch all branches for this recently pushed repo
      try {
        const branchesRes = await axios.get(`https://api.github.com/repos/${repoName}/branches`, { headers });

        for (const branch of branchesRes.data || []) {
          try {
            // Fetch commits for this specific branch authored by the user today
            const branchCommitsRes = await axios.get(`https://api.github.com/repos/${repoName}/commits`, {
              headers,
              params: { sha: branch.name, author: username, since },
            });

            for (const item of branchCommitsRes.data || []) {
              const key = `${repoName}-${item.sha}`;
              if (!commitsMap.has(key)) {
                commitsMap.set(key, {
                  repoName,
                  message: item.commit.message,
                  date: item.commit.author.date,
                  authorName: item.commit.author.name,
                  codeDiff: item.url,
                  commitUrl: item.html_url,
                });
              }
            }
          } catch (e) {
            // Ignore branch-specific errors
          }
        }
      } catch (e) {
        // Ignore repo-specific branch fetching errors
      }
    });
  } catch (error: any) {
    console.warn('Direct Repo Scanning encountered an error:', error.response?.data || error.message);
  }

  const uniqueCommits = Array.from(commitsMap.values());

  // 4. Fetch Code Diffs for each commit to allow the AI to read the actual code changes.
  //    Parallelized with a bounded pool — this is the heaviest fan-out (one call per commit).
  await mapWithConcurrency(uniqueCommits, GITHUB_API_CONCURRENCY, async (commit) => {
    if (commit.codeDiff && commit.codeDiff.startsWith('https://api.github.com/')) {
      try {
        const commitData = await axios.get(commit.codeDiff, { headers });
        const IGNORED_EXTS = ['.lock', 'package-lock.json', 'yarn.lock', '.svg', '.png', '.jpg', 'dist/', 'build/', '.min.js'];
        const files = (commitData.data.files || []).filter(
          (f: any) => !IGNORED_EXTS.some(ext => f.filename.endsWith(ext) || f.filename.includes(ext))
        );
        
        // Smart Token Optimization: Truncate per-file to ensure we see all files, rather than blindly truncating the massive string
        let totalAdditions = 0;
        let totalDeletions = 0;
        const fileTypes: Record<string, number> = {};

        const patch = files
          .map((f: any) => {
            totalAdditions += f.additions || 0;
            totalDeletions += f.deletions || 0;
            // Tally the file extension (e.g. ".ts", ".css") for a per-repo breakdown
            const dotIndex = f.filename.lastIndexOf('.');
            const ext = dotIndex > 0 ? f.filename.slice(dotIndex) : '(no ext)';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            const filePatch = f.patch || 'No patch available';
            // 400 chars is usually enough to see the core logic change without reading boilerplate
            return `File: ${f.filename}\n${filePatch.substring(0, 400)}${filePatch.length > 400 ? '...(truncated)' : ''}`;
          })
          .join('\n\n')
          .substring(0, 2000); // Safe maximum per commit

        commit.codeDiff = patch ? patch : 'No code changes found.';
        commit.fileTypes = fileTypes;
        commit.stats = {
          files: files.length,
          additions: totalAdditions,
          deletions: totalDeletions,
        };
      } catch (e) {
        commit.codeDiff = 'Failed to fetch code diff.';
        commit.stats = { files: 0, additions: 0, deletions: 0 };
      }
    } else {
      commit.codeDiff = 'No URL available for diff.';
      commit.stats = { files: 0, additions: 0, deletions: 0 };
    }
  });

  return uniqueCommits;
};

