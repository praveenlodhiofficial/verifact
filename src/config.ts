// Configuration file for the extension
// Reads from environment variables and provides a centralized config
// Supports both PipeShift API (OpenAI-compatible) and OpenAI API

interface Config {
  openai: {
    apiKey: string;
    model: string;
    baseUrl: string;
    maxTokens: number;
  };
  factCheck: {
    maxClaims: number;
  };
}

// Get environment variables (Vite uses import.meta.env)
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // In Vite, environment variables prefixed with VITE_ are exposed
  const value = import.meta.env[key];
  return value || defaultValue;
};

// Default configuration
// Defaults to PipeShift API (Neysa's Qwen model) - can be overridden via .env
const defaultConfig: Config = {
  openai: {
    apiKey: getEnvVar('VITE_OPENAI_API_KEY', ''),
    model: getEnvVar('VITE_OPENAI_MODEL', 'neysa-qwen3-vl-30b-a3b'),
    baseUrl: getEnvVar('VITE_OPENAI_API_BASE_URL', 'https://api.pipeshift.com/api/v0'),
    maxTokens: 5000, // Increased for Qwen model
  },
  factCheck: {
    maxClaims: parseInt(getEnvVar('VITE_MAX_CLAIMS', '5'), 10) || 5,
  },
};

// Export configuration
export const config: Config = defaultConfig;

// Helper function to get OpenAI API key
// Priority: 1. User-provided key from storage, 2. Environment variable
export async function getOpenAIApiKey(): Promise<string> {
  try {
    // Try to get from Chrome storage first (user-set key)
    const result = await chrome.storage.local.get(['openaiApiKey']);
    if (result.openaiApiKey) {
      return result.openaiApiKey;
    }
  } catch (error) {
    console.warn('Could not access Chrome storage:', error);
  }
  
  // Fallback to environment variable
  return config.openai.apiKey;
}

// Helper function to check if API key is configured
export async function isApiKeyConfigured(): Promise<boolean> {
  const key = await getOpenAIApiKey();
  return key.length > 0;
}

// Export individual config values for convenience
export const OPENAI_CONFIG = config.openai;
export const FACT_CHECK_CONFIG = config.factCheck;

