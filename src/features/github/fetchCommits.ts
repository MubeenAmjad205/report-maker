import axios from 'axios';
import { GithubCommit } from '../../shared/types/global.types';

export const fetchTodayCommits = async (
  token: string,
  username: string,
  since: string
): Promise<GithubCommit[]> => {
  const commitsMap = new Map<string, GithubCommit>();
  const todayDateStr = since.split('T')[0]; // Extract YYYY-MM-DD
  
  // 1. Fetch from Search API (captures older branches, but misses unverified emails and non-default branches)
  try {
    const query = `author:${username} committer-date:>=${todayDateStr}`;
    const searchRes = await axios.get(`https://api.github.com/search/commits`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: { q: query, per_page: 100, sort: 'author-date', order: 'desc' },
    });

    const items = searchRes.data.items || [];
    for (const item of items) {
      const repoName = item.repository.full_name;
      const message = item.commit.message;
      commitsMap.set(`${repoName}-${message}`, {
        repoName,
        message,
        date: item.commit.author.date,
        authorName: item.commit.author.name,
      });
    }
  } catch (error: any) {
    console.warn('Search API encountered an error:', error.response?.data || error.message);
  }

  // 2. Fetch from Events API (captures real-time pushes, non-default branches, and different git emails)
  try {
    const eventsRes = await axios.get(`https://api.github.com/users/${username}/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: { per_page: 100 },
    });

    const events = eventsRes.data || [];
    for (const event of events) {
      if (event.type === 'PushEvent') {
        const repoName = event.repo.name;
        // events API returns date in 'created_at' e.g. 2026-06-22T...
        if (event.created_at >= todayDateStr) {
          for (const commit of event.payload.commits || []) {
            const message = commit.message;
            const key = `${repoName}-${message}`;
            if (!commitsMap.has(key)) {
              commitsMap.set(key, {
                repoName,
                message,
                date: event.created_at,
                authorName: commit.author?.name || username,
              });
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.warn('Events API encountered an error:', error.response?.data || error.message);
  }

  return Array.from(commitsMap.values());
};
