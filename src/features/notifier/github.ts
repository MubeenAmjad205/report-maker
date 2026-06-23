import axios from 'axios';
import { getTodayDateString } from '../../shared/utils/date.utils';

export const sendGitHubIssueNotification = async (
  token: string,
  repoFullName: string, // e.g., MubeenAmjad205/report-maker
  username: string,
  reportText: string
): Promise<void> => {
  try {
    const url = `https://api.github.com/repos/${repoFullName}/issues`;
    
    // We wrap the report in a code block or just pass it as plain text. 
    // GitHub handles plain text with emojis perfectly.
    const body = `Here is your automated daily report:\n\n${reportText}`;

    await axios.post(
      url,
      {
        title: `📊 Daily Development Report: ${getTodayDateString()}`,
        body: body,
        assignees: [username],
        labels: ['automated-report'],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    console.log(`Successfully created GitHub Issue notification in ${repoFullName}.`);
  } catch (error: any) {
    console.error('Error creating GitHub Issue notification:', error.response?.data || error.message);
    // We don't throw here to avoid crashing the whole pipeline if just this notification fails
  }
};
