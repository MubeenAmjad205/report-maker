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
    model: process.env.AI_MODEL || 'google/gemini-1.5-flash',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  msteams: {
    webhookUrl: process.env.MSTEAMS_WEBHOOK_URL || '',
  }
};

export const validateConfig = (): void => {
  if (!config.github.token) throw new Error('GH_PAT is required');
  if (!config.github.username) throw new Error('GITHUB_USERNAME is required');
  if (!config.ai.apiKey) throw new Error('AI_API_KEY is required');
  
  const hasTelegram = config.telegram.botToken && config.telegram.chatId;
  const hasMsTeams = !!config.msteams.webhookUrl;

  if (!hasTelegram && !hasMsTeams) {
    throw new Error('You must configure at least one delivery method: Telegram or MS Teams.');
  }
};
