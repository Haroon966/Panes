import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'mistral'
  | 'ollama'
  | 'lmstudio'
  | 'custom';

export interface ModelRequestAuth {
  provider: ProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

function envKey(provider: ProviderId): string | undefined {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'google':
      return process.env.GOOGLE_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'mistral':
      return process.env.MISTRAL_API_KEY;
    default:
      return undefined;
  }
}

export function createLanguageModel(auth: ModelRequestAuth): LanguageModel {
  const key = auth.apiKey?.trim() || envKey(auth.provider);
  const modelId = auth.model;

  switch (auth.provider) {
    case 'openai': {
      const k = key ?? '';
      if (!k) throw new Error('OpenAI API key missing (body or OPENAI_API_KEY)');
      const openai = createOpenAI({ apiKey: k });
      return openai(modelId);
    }
    case 'anthropic': {
      const k = key ?? '';
      if (!k) throw new Error('Anthropic API key missing (body or ANTHROPIC_API_KEY)');
      const anthropic = createAnthropic({ apiKey: k });
      return anthropic(modelId);
    }
    case 'google': {
      const k = key ?? '';
      if (!k) throw new Error('Google API key missing (body or GOOGLE_API_KEY)');
      const google = createGoogleGenerativeAI({ apiKey: k });
      return google(modelId);
    }
    case 'groq': {
      const k = key ?? '';
      if (!k) throw new Error('Groq API key missing (body or GROQ_API_KEY)');
      const groq = createGroq({ apiKey: k });
      return groq(modelId);
    }
    case 'mistral': {
      const k = key ?? '';
      if (!k) throw new Error('Mistral API key missing (body or MISTRAL_API_KEY)');
      const mistral = createMistral({ apiKey: k });
      return mistral(modelId);
    }
    case 'ollama': {
      const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollama = createOpenAI({
        baseURL: `${base.replace(/\/$/, '')}/v1`,
        apiKey: 'ollama',
      });
      return ollama(modelId);
    }
    case 'lmstudio': {
      const base = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234';
      const lm = createOpenAI({
        baseURL: `${base.replace(/\/$/, '')}/v1`,
        apiKey: 'lm-studio',
      });
      return lm(modelId);
    }
    case 'custom': {
      const base = auth.baseUrl?.trim();
      if (!base) throw new Error('Custom provider requires baseUrl');
      const custom = createOpenAI({
        baseURL: base.replace(/\/$/, ''),
        apiKey: key || 'custom',
      });
      return custom(modelId);
    }
    default:
      throw new Error(`Unknown provider: ${auth.provider}`);
  }
}
