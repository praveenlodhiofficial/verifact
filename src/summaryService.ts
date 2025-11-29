// Service to generate summary of webpage content using AI
import { getOpenAIApiKey, OPENAI_CONFIG } from './config';

export interface SummaryResponse {
  summary: string;
  keyPoints: string[];
  category: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  wordCount: number;
}

// Generate summary of webpage content
export async function generateSummary(
  title: string,
  text: string,
  url: string
): Promise<SummaryResponse> {
  const apiKey = await getOpenAIApiKey();
  
  if (!apiKey) {
    throw new Error('API key is required to generate summary');
  }

  // Limit text length for API call
  const textPreview = text.substring(0, 4000);
  
  const prompt = `You are a news summarization assistant. Analyze the following webpage content and provide a comprehensive summary.

Webpage Title: "${title}"
Webpage URL: ${url}
Content: ${textPreview}

Please provide:
1. A concise summary (2-3 paragraphs) of the main content
2. 5-7 key points or important facts
3. The category/topic (e.g., "Technology", "Politics", "Sports", "Entertainment", etc.)
4. Overall sentiment (positive, negative, or neutral)
5. Estimated word count of the original content

Respond in JSON format:
{
  "summary": "A comprehensive 2-3 paragraph summary of the content...",
  "keyPoints": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "category": "Technology",
  "sentiment": "neutral",
  "wordCount": 1500
}`;

  try {
    const apiUrl = `${OPENAI_CONFIG.baseUrl}/chat/completions`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional news summarization assistant. Always respond with valid JSON only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1500,
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

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from API');
    }

    const result: SummaryResponse = JSON.parse(jsonMatch[0]);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate summary');
  }
}

