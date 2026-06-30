import axios from 'axios';
import { FEATURE_FLAGS } from '../../shared/constants/flags';

export const sendMSTeamsMessage = async (
  webhookUrl: string,
  message: string
): Promise<void> => {
  if (FEATURE_FLAGS.ENABLE_DRY_RUN || !FEATURE_FLAGS.ENABLE_MSTEAMS_NOTIFICATIONS) {
    console.log('[DRY RUN] MS Teams Notification Skipped.');
    console.log(message);
    return;
  }

  try {
    // MS Teams expects a JSON payload. A simple text message can be sent using the 'text' property.
    await axios.post(webhookUrl, {
      text: message,
    });
    console.log('Successfully sent message to MS Teams.');
  } catch (error: any) {
    console.error('Error sending message to MS Teams:', error.response?.data || error.message);
    throw error;
  }
};
