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
    const response = await axios.get(`https://api.github.com/users/${username}/events`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: {
        per_page: 100,
      },
    });

    const events = response.data;
    
    for (const event of events) {
      if (event.type === 'PushEvent' && new Date(event.created_at) >= new Date(since)) {
        const repoName = event.repo.name;
        const pushCommits = event.payload.commits || [];
        
        for (const commit of pushCommits) {
          // Verify it's the user's commit
          if (commit.author.name === username || event.actor.login === username) {
            commits.push({
              repoName,
              message: commit.message,
              date: event.created_at,
            });
          }
        }
      }
    }
    
    return commits;
  } catch (error) {
    console.error('Error fetching commits from GitHub:', error);
    throw error;
  }
};
