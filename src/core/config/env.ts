import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  github: {
    token: process.env.GH_PAT || '',
    username: process.env.GITHUB_USERNAME || '',
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'GEMINI').toUpperCase(),
    apiKey: process.env.AI_API_KEY || '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
};

export const validateConfig = (): void => {
  if (!config.github.token) throw new Error('GH_PAT is required');
  if (!config.github.username) throw new Error('GITHUB_USERNAME is required');
  if (!config.ai.apiKey) throw new Error('AI_API_KEY is required');
  if (!config.telegram.botToken) throw new Error('TELEGRAM_BOT_TOKEN is required');
  if (!config.telegram.chatId) throw new Error('TELEGRAM_CHAT_ID is required');
};
