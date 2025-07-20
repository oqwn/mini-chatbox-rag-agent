import { Request, Response } from 'express';
import { ConfigService } from '@/services/config.service';
import { OpenAIService } from '@/services/openai.service';
import { Logger } from 'winston';

export class SettingsController {
  constructor(
    private configService: ConfigService,
    private openAIService: OpenAIService,
    private logger: Logger
  ) {}

  public async getSettings(_req: Request, res: Response): Promise<void> {
    try {
      const openaiConfig = this.configService.getOpenAIConfig();
      const ragConfig = this.configService.getRagConfig();
      const models = await this.openAIService.getAvailableModels();

      // Don't send the actual API keys to frontend, just indicate if they're set
      res.json({
        openai: {
          isConfigured: !!openaiConfig.apiKey,
          baseUrl: openaiConfig.baseUrl,
          model: openaiConfig.model,
          availableModels: models,
        },
        rag: {
          embedding: {
            model: ragConfig.embeddingModel,
            endpoint: ragConfig.embeddingEndpoint,
            isConfigured: !!ragConfig.embeddingModel || !!ragConfig.embeddingEndpoint,
          },
          reranking: {
            endpoint: ragConfig.rerankEndpoint,
            hasApiKey: !!ragConfig.rerankApiKey,
            forceLocal: ragConfig.rerankForceLocal,
            isConfigured: !!ragConfig.rerankEndpoint || ragConfig.rerankForceLocal === 'true',
          },
        },
      });
    } catch (error) {
      this.logger.error('Get settings error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }

  public async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { openai, rag } = req.body;

      if (!openai && !rag) {
        res.status(400).json({ error: 'Settings required' });
        return;
      }

      // Update OpenAI settings if provided
      if (openai) {
        const { apiKey, baseUrl, model } = openai;

        if (!apiKey) {
          res.status(400).json({ error: 'API key is required' });
          return;
        }

        // Update configuration
        this.configService.updateOpenAIConfig(apiKey, baseUrl, model);

        // Reinitialize OpenAI client with new settings
        this.openAIService.updateConfiguration(apiKey, baseUrl);
      }

      // Update RAG settings if provided
      if (rag) {
        const { embedding, reranking } = rag;
        const ragConfig: any = {};

        if (embedding) {
          if (embedding.model !== undefined) ragConfig.embeddingModel = embedding.model;
          if (embedding.endpoint !== undefined) ragConfig.embeddingEndpoint = embedding.endpoint;
        }

        if (reranking) {
          if (reranking.endpoint !== undefined) ragConfig.rerankEndpoint = reranking.endpoint;
          if (reranking.apiKey !== undefined) ragConfig.rerankApiKey = reranking.apiKey;
          if (reranking.forceLocal !== undefined) ragConfig.rerankForceLocal = reranking.forceLocal;
        }

        // Update RAG configuration
        this.configService.updateRagConfig(ragConfig);
      }

      res.json({
        success: true,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      this.logger.error('Update settings error:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
}
