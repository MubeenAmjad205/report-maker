import axios from 'axios';
import { GithubCommit } from '../../shared/types/global.types';

export const fetchTodayCommits = async (
  token: string,
  username: string,
  since: string
): Promise<GithubCommit[]> => {
  const commits: GithubCommit[] = [];
  
  // To get commits across all repos, the simplest way via REST API is to query the user's events
  // However, events API only returns up to 300 events. For a single day, this is usually enough.
  // We'll use the /users/{username}/events API to find PushEvents.
  
  try {
    const today = since.split('T')[0]; // Extract YYYY-MM-DD
    const query = `author:${username} committer-date:>=${today}`;
    
    const response = await axios.get(`https://api.github.com/search/commits`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: {
        q: query,
        per_page: 100,
        sort: 'author-date',
        order: 'desc'
      },
    });

    const items = response.data.items || [];
    
    for (const item of items) {
      commits.push({
        repoName: item.repository.full_name,
        message: item.commit.message,
        date: item.commit.author.date,
      });
    }
    
    return commits;
  } catch (error) {
    console.error('Error fetching commits from GitHub:', error);
    throw error;
  }
};
