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
      const config = this.configService.getOpenAIConfig();
      const models = await this.openAIService.getAvailableModels();

      // Don't send the actual API key to frontend, just indicate if it's set
      res.json({
        openai: {
          isConfigured: !!config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          availableModels: models,
        },
      });
    } catch (error) {
      this.logger.error('Get settings error:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }

  public async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const { openai } = req.body;

      if (!openai) {
        res.status(400).json({ error: 'OpenAI settings required' });
        return;
      }

      const { apiKey, baseUrl, model } = openai;

      if (!apiKey) {
        res.status(400).json({ error: 'API key is required' });
        return;
      }

      // Update configuration
      this.configService.updateOpenAIConfig(apiKey, baseUrl, model);

      // Reinitialize OpenAI client with new settings
      this.openAIService.updateConfiguration(apiKey, baseUrl);

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
