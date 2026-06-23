import axios from 'axios';
import { AI_PROVIDERS } from '../../shared/constants/flags';

export interface AIProviderResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type AIProviderCall = (prompt: string, apiKey: string, model: string) => Promise<AIProviderResponse>;

export const generateWithGemini: AIProviderCall = async (prompt, apiKey, model) => {
  // Using the new Gemini REST endpoint (e.g. gemini-1.5-flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
  });
  const usage = response.data.usageMetadata;
  return {
    text: response.data.candidates[0].content.parts[0].text,
    usage: usage ? {
      promptTokens: usage.promptTokenCount,
      completionTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
    } : undefined
  };
};

export const generateWithOpenAI: AIProviderCall = async (prompt, apiKey, model) => {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  const usage = response.data.usage;
  return {
    text: response.data.choices[0].message.content,
    usage: usage ? {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    } : undefined
  };
};

export const generateWithOpenRouter: AIProviderCall = async (prompt, apiKey, model) => {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: model || 'google/gemini-flash-1.5',
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  const usage = response.data.usage;
  return {
    text: response.data.choices[0].message.content,
    usage: usage ? {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    } : undefined
  };
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
