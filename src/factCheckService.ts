// Fact-checking service using OpenAI API
import { FACT_CHECK_CONFIG, getOpenAIApiKey, OPENAI_CONFIG } from './config';

export interface FactCheckResult {
  claim: string;
  verdict: 'true' | 'false' | 'misleading' | 'unverified';
  confidence: number;
  explanation: string;
  sources: string[];
  reasoning: string;
}

export interface FactCheckResponse {
  claims: FactCheckResult[];
  overallVerdict: 'mostly_true' | 'mostly_false' | 'mixed' | 'unverified';
  summary: string;
}

// Extract key claims from webpage text
export function extractClaims(text: string, maxClaims: number = FACT_CHECK_CONFIG.maxClaims): string[] {
  // Simple extraction: look for sentences that make factual claims
  // This is a basic implementation - could be enhanced with NLP
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500);

  // Filter for sentences that seem like factual claims
  const claimIndicators = [
    /\d{4}/, // Contains a year
    /(is|are|was|were|has|have|will|can|should|must)\s+/i, // Contains action verbs
    /(according to|research shows|studies|data|report|found|discovered)/i, // Factual language
  ];

  const potentialClaims = sentences.filter(sentence => {
    return claimIndicators.some(pattern => pattern.test(sentence));
  });

  // Return top claims, prioritizing longer sentences with numbers
  return potentialClaims
    .sort((a, b) => {
      const aHasNumber = /\d/.test(a);
      const bHasNumber = /\d/.test(b);
      if (aHasNumber && !bHasNumber) return -1;
      if (!aHasNumber && bHasNumber) return 1;
      return b.length - a.length;
    })
    .slice(0, maxClaims);
}

// Fact-check using OpenAI API
export async function factCheckContent(
  claims: string[],
  webpageTitle: string,
  apiKey?: string
): Promise<FactCheckResponse> {
  // Get API key from parameter, storage, or config
  let finalApiKey = apiKey;
  if (!finalApiKey) {
    finalApiKey = await getOpenAIApiKey();
  }
  
  if (!finalApiKey) {
    throw new Error('OpenAI API key is required. Please set it in Settings or .env file.');
  }

  const prompt = `You are a fact-checking assistant. Analyze the following claims from a webpage titled "${webpageTitle}".

For each claim, provide:
1. Verdict: "true", "false", "misleading", or "unverified"
2. Confidence: A number from 0-100
3. Explanation: A brief explanation of your verdict
4. Sources: List 2-3 credible sources that support or refute the claim (URLs or publication names)
5. Reasoning: Detailed reasoning for your verdict

Claims to fact-check:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Respond in JSON format:
{
  "claims": [
    {
      "claim": "the claim text",
      "verdict": "true|false|misleading|unverified",
      "confidence": 85,
      "explanation": "brief explanation",
      "sources": ["source1", "source2"],
      "reasoning": "detailed reasoning"
    }
  ],
  "overallVerdict": "mostly_true|mostly_false|mixed|unverified",
  "summary": "overall summary of fact-checking results"
}`;

  try {
    const apiUrl = `${OPENAI_CONFIG.baseUrl}/chat/completions`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional fact-checker. Always respond with valid JSON only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.6, // Using 0.6 as recommended for Qwen model
        max_tokens: OPENAI_CONFIG.maxTokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from API');
    }

    // Extract JSON from response (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from API');
    }

    const result: FactCheckResponse = JSON.parse(jsonMatch[0]);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fact-check content');
  }
}

// Alternative: Use a free fact-checking API (Google Fact Check API)
// Note: This requires a Google API key and has limited free tier
export async function factCheckWithGoogle(
  query: string,
  apiKey: string
): Promise<unknown> {
  // This is a placeholder - Google Fact Check API requires setup
  // You would need to enable the Fact Check Tools API in Google Cloud Console
  const url = `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }
  
  return response.json();
}
