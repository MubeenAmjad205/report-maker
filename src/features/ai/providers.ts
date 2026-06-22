import axios from 'axios';
import { AI_PROVIDERS } from '../../shared/constants/flags';

export type AIProviderCall = (prompt: string, apiKey: string) => Promise<string>;

export const generateWithGemini: AIProviderCall = async (prompt, apiKey) => {
  // Using the new Gemini REST endpoint (e.g. gemini-1.5-flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
  });
  return response.data.candidates[0].content.parts[0].text;
};

export const generateWithOpenAI: AIProviderCall = async (prompt, apiKey) => {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  return response.data.choices[0].message.content;
};

export const generateWithOpenRouter: AIProviderCall = async (prompt, apiKey) => {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'google/gemini-flash-1.5',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  return response.data.choices[0].message.content;
};

export const getAIProvider = (providerKey: string): AIProviderCall => {
  switch (providerKey) {
    case AI_PROVIDERS.GEMINI:
      return generateWithGemini;
    case AI_PROVIDERS.OPENAI:
      return generateWithOpenAI;
    case AI_PROVIDERS.OPENROUTER:
      return generateWithOpenRouter;
    default:
      console.warn(`Unknown AI Provider: ${providerKey}. Falling back to Gemini.`);
      return generateWithGemini;
  }
};
