import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { ChatMistralAI } from '@langchain/mistralai';
import { ChatOpenAI } from '@langchain/openai';
import type { ModelRequestAuth, ProviderId } from './modelFactory';

export type { ModelRequestAuth, ProviderId };

function agentTemperature(): number | undefined {
  const raw = process.env.AGENT_TEMPERATURE?.trim();
  if (raw === undefined || raw === '') return 0.15;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.15;
  return Math.min(2, Math.max(0, n));
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

/** LangChain chat model matching {@link createLanguageModel} provider behavior. */
export function createChatModel(auth: ModelRequestAuth): BaseChatModel {
  const key = auth.apiKey?.trim() || envKey(auth.provider);
  const modelId = auth.model;

  switch (auth.provider) {
    case 'openai': {
      const k = key ?? '';
      if (!k) throw new Error('OpenAI API key missing (body or OPENAI_API_KEY)');
      return new ChatOpenAI({ model: modelId, apiKey: k, temperature: agentTemperature() });
    }
    case 'anthropic': {
      const k = key ?? '';
      if (!k) throw new Error('Anthropic API key missing (body or ANTHROPIC_API_KEY)');
      return new ChatAnthropic({ model: modelId, apiKey: k, temperature: agentTemperature() });
    }
    case 'google': {
      const k = key ?? '';
      if (!k) throw new Error('Google API key missing (body or GOOGLE_API_KEY)');
      return new ChatGoogleGenerativeAI({
        model: modelId,
        apiKey: k,
        temperature: agentTemperature(),
      });
    }
    case 'groq': {
      const k = key ?? '';
      if (!k) throw new Error('Groq API key missing (body or GROQ_API_KEY)');
      return new ChatGroq({ model: modelId, apiKey: k, temperature: agentTemperature() });
    }
    case 'mistral': {
      const k = key ?? '';
      if (!k) throw new Error('Mistral API key missing (body or MISTRAL_API_KEY)');
      return new ChatMistralAI({ model: modelId, apiKey: k, temperature: agentTemperature() });
    }
    case 'ollama': {
      const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      return new ChatOpenAI({
        model: modelId,
        configuration: { baseURL: `${base.replace(/\/$/, '')}/v1` },
        apiKey: 'ollama',
        temperature: agentTemperature(),
      });
    }
    case 'lmstudio': {
      const base = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234';
      return new ChatOpenAI({
        model: modelId,
        configuration: { baseURL: `${base.replace(/\/$/, '')}/v1` },
        apiKey: 'lm-studio',
        temperature: agentTemperature(),
      });
    }
    case 'custom': {
      const base = auth.baseUrl?.trim();
      if (!base) throw new Error('Custom provider requires baseUrl');
      return new ChatOpenAI({
        model: modelId,
        configuration: { baseURL: base.replace(/\/$/, '') },
        apiKey: key || 'custom',
        temperature: agentTemperature(),
      });
    }
    default:
      throw new Error(`Unknown provider: ${auth.provider}`);
  }
}

/**
 * LangChain {@link ChatOpenAI} against any OpenAI-compatible HTTP API (Groq, Ollama /v1, LM Studio, Cline bridges).
 * @param baseUrlWithoutV1 — e.g. `https://api.groq.com/openai` or `http://127.0.0.1:11434` (no trailing slash)
 */
export function createOpenAiCompatibleUpstreamChatModel(
  baseUrlWithoutV1: string,
  model: string,
  bearerToken: string | undefined
): ChatOpenAI {
  const root = baseUrlWithoutV1.trim().replace(/\/$/, '');
  const baseURL = root.endsWith('/v1') ? root : `${root}/v1`;
  const apiKey = bearerToken?.trim() || 'ollama';
  return new ChatOpenAI({
    model,
    apiKey,
    configuration: { baseURL },
    temperature: agentTemperature(),
  });
}
