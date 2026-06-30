import axios from 'axios';
import { FEATURE_FLAGS } from '../../shared/constants/flags';

export const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  message: string
): Promise<void> => {
  if (FEATURE_FLAGS.ENABLE_DRY_RUN || !FEATURE_FLAGS.ENABLE_TELEGRAM_NOTIFICATIONS) {
    console.log('[DRY RUN] Telegram Notification Skipped.');
    console.log(message);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
    console.log('Successfully sent message to Telegram.');
  } catch (error: any) {
    console.error('Error sending message to Telegram:', error.response?.data || error.message);
    throw error;
  }
};
