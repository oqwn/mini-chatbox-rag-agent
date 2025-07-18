import { Request, Response } from 'express';
import { OpenAIService } from '@/services/openai.service';
import { Logger } from 'winston';

export class ChatController {
  constructor(
    private openAIService: OpenAIService,
    private logger: Logger
  ) {}

  public async chat(req: Request, res: Response): Promise<void> {
    try {
      const { messages, options } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Messages array is required' });
        return;
      }

      if (!this.openAIService.isConfigured()) {
        res
          .status(503)
          .json({ error: 'OpenAI service not configured. Please set up API key in settings.' });
        return;
      }

      const response = await this.openAIService.chat(messages, options);
      res.json({ message: response });
    } catch (error) {
      this.logger.error('Chat error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  public async chatStream(req: Request, res: Response): Promise<void> {
    try {
      const { messages, options } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'Messages array is required' });
        return;
      }

      if (!this.openAIService.isConfigured()) {
        res
          .status(503)
          .json({ error: 'OpenAI service not configured. Please set up API key in settings.' });
        return;
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Send initial connection message
      res.write('data: {"type":"connected"}\n\n');

      try {
        for await (const chunk of this.openAIService.chatStream(messages, options)) {
          res.write(`data: {"type":"content","content":${JSON.stringify(chunk)}}\n\n`);
        }
        res.write('data: {"type":"done"}\n\n');
      } catch (streamError) {
        const errorMessage = streamError instanceof Error ? streamError.message : 'Stream error';
        res.write(`data: {"type":"error","error":${JSON.stringify(errorMessage)}}\n\n`);
      }

      res.end();
    } catch (error) {
      this.logger.error('Chat stream error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}
