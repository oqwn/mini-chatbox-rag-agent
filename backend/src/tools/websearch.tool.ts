import { BaseTool, ToolDefinition } from './base.tool';
import { Logger } from 'winston';
import axios from 'axios';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export class WebSearchTool extends BaseTool {
  private searchApiKey?: string;
  private searchEngineId?: string;

  constructor(private logger: Logger) {
    super();
    // These should be configured via environment variables
    this.searchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  }

  get definition(): ToolDefinition {
    return {
      name: 'web_search',
      description: 'Search the web for information using Google Search API',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query',
          required: true,
        },
        {
          name: 'num_results',
          type: 'number',
          description: 'Number of results to return (1-10)',
        },
        {
          name: 'site',
          type: 'string',
          description: 'Limit search to a specific site (e.g., "wikipedia.org")',
        },
        {
          name: 'file_type',
          type: 'string',
          description: 'Filter by file type (e.g., "pdf", "doc")',
        },
      ],
    };
  }

  async execute(parameters: {
    query: string;
    num_results?: number;
    site?: string;
    file_type?: string;
  }): Promise<any> {
    const { query, num_results = 5, site, file_type } = parameters;

    if (!this.searchApiKey || !this.searchEngineId) {
      // Fallback to DuckDuckGo if Google API is not configured
      return this.duckDuckGoSearch(query, num_results);
    }

    try {
      let searchQuery = query;
      if (site) {
        searchQuery = `site:${site} ${query}`;
      }
      if (file_type) {
        searchQuery = `${searchQuery} filetype:${file_type}`;
      }

      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.searchApiKey,
          cx: this.searchEngineId,
          q: searchQuery,
          num: Math.min(num_results, 10),
        },
      });

      const results: SearchResult[] =
        response.data.items?.map((item: any) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          source: new URL(item.link).hostname,
        })) || [];

      this.logger.info(`Web search completed for query: "${query}" (${results.length} results)`);

      return {
        success: true,
        query: searchQuery,
        results,
        total_results: response.data.searchInformation?.totalResults || 0,
        search_time: response.data.searchInformation?.searchTime || 0,
      };
    } catch (error) {
      this.logger.error('Google search failed, falling back to DuckDuckGo:', error);
      return this.duckDuckGoSearch(query, num_results);
    }
  }

  private async duckDuckGoSearch(query: string, numResults: number): Promise<any> {
    try {
      // DuckDuckGo Instant Answer API (limited but free)
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1,
        },
      });

      const results: SearchResult[] = [];

      // Add instant answer if available
      if (response.data.AbstractText) {
        results.push({
          title: response.data.Heading || query,
          url: response.data.AbstractURL || '',
          snippet: response.data.AbstractText,
          source: response.data.AbstractSource || 'DuckDuckGo',
        });
      }

      // Add related topics
      response.data.RelatedTopics?.slice(0, numResults - 1).forEach((topic: any) => {
        if (topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL || '',
            snippet: topic.Text,
            source: 'DuckDuckGo',
          });
        }
      });

      this.logger.info(
        `DuckDuckGo search completed for query: "${query}" (${results.length} results)`
      );

      return {
        success: true,
        query,
        results,
        total_results: results.length,
        search_engine: 'DuckDuckGo',
        note: 'Using DuckDuckGo fallback. For better results, configure Google Search API.',
      };
    } catch (error) {
      this.logger.error('DuckDuckGo search failed:', error);
      throw new Error(
        `Web search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
