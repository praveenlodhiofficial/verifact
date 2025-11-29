// Service to find similar sources/articles using AI API
import { getOpenAIApiKey, OPENAI_CONFIG } from './config';

export interface SimilarSource {
  title: string;
  url: string;
  description: string;
  relevance: number;
  publisher: string;
}

export interface SourceSearchResponse {
  sources: SimilarSource[];
  query: string;
  totalFound: number;
}

// Find similar sources/articles using AI
export async function findSimilarSources(
  webpageTitle: string,
  webpageText: string,
  webpageUrl: string
): Promise<SourceSearchResponse> {
  const apiKey = await getOpenAIApiKey();
  
  if (!apiKey) {
    throw new Error('API key is required to find similar sources');
  }

  // Extract key topics/keywords from the webpage
  const textPreview = webpageText.substring(0, 2000); // Use first 2000 chars for context
  
  const prompt = `You are a research assistant. Analyze the following webpage content and find similar articles/sources that discuss the same or related topics.

Webpage Title: "${webpageTitle}"
Webpage URL: ${webpageUrl}
Content Preview: ${textPreview}

Based on this content, provide a list of 10-15 similar sources/articles that cover the same or related information. For each source, provide:
1. Title of the article/source
2. URL (if you know it, otherwise provide a search query)
3. Brief description of how it relates
4. Publisher/source name
5. Relevance score (0-100)

Respond in JSON format:
{
  "sources": [
    {
      "title": "Article Title",
      "url": "https://example.com/article",
      "description": "Brief description of how this relates",
      "relevance": 85,
      "publisher": "Publisher Name"
    }
  ],
  "query": "main search query for this topic",
  "totalFound": 15
}

If you don't know exact URLs, provide search queries or well-known publication URLs that would likely have similar content.`;

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
            content: 'You are a professional research assistant. Always respond with valid JSON only, no additional text. Provide realistic and credible sources.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
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

    const result: SourceSearchResponse = JSON.parse(jsonMatch[0]);
    
    // Validate and clean URLs - if URL is a search query, convert to Google search URL
    result.sources = result.sources.map(source => {
      if (source.url && !source.url.startsWith('http')) {
        // Convert search query to Google search URL
        source.url = `https://www.google.com/search?q=${encodeURIComponent(source.url)}`;
      } else if (!source.url || !source.url.startsWith('http')) {
        // Create Google search URL from title if no URL
        source.url = `https://www.google.com/search?q=${encodeURIComponent(source.title)}`;
      }
      return source;
    });

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to find similar sources');
  }
}

