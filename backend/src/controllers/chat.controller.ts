import { Request, Response } from 'express';
import { OpenAIService } from '@/services/openai.service';
import { MCPService } from '@/services/mcp.service';
import { Logger } from 'winston';

export class ChatController {
  constructor(
    private openAIService: OpenAIService,
    private mcpService: MCPService,
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
          .json({ error: 'AI service not configured. Please set up API key in settings.' });
        return;
      }

      // Get available MCP tools
      const mcpTools = await this.mcpService.getAllTools();
      
      const response = await this.openAIService.chat(messages, {
        ...options,
        tools: mcpTools,
        onToolCall: async (toolName: string, parameters: any) => {
          // Find the tool and invoke it
          const tool = mcpTools.find(t => t.name === toolName);
          if (tool) {
            return await this.mcpService.invokeTool(tool.serverId, toolName, parameters);
          }
          throw new Error(`Tool ${toolName} not found`);
        }
      });
      
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
          .json({ error: 'AI service not configured. Please set up API key in settings.' });
        return;
      }

      // Set up streaming headers
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
      res.setHeader('Transfer-Encoding', 'chunked');

      res.flushHeaders();

      // Get available MCP tools
      const mcpTools = await this.mcpService.getAllTools();
      
      try {
        let chunkCount = 0;
        for await (const chunk of this.openAIService.chatStream(messages, {
          ...options,
          tools: mcpTools,
          onToolCall: async (toolName: string, parameters: any) => {
            // Find the tool and invoke it
            const tool = mcpTools.find(t => t.name === toolName);
            if (tool) {
              return await this.mcpService.invokeTool(tool.serverId, toolName, parameters);
            }
            throw new Error(`Tool ${toolName} not found`);
          }
        })) {
          chunkCount++;
          this.logger.debug(`Sending chunk ${chunkCount}: ${chunk}`);
          res.write(chunk);
          // Force flush to send data immediately
          if (res.flush) res.flush();
        }
        this.logger.info(`Stream completed with ${chunkCount} chunks`);
      } catch (streamError) {
        const errorMessage = streamError instanceof Error ? streamError.message : 'Stream error';
        this.logger.error('Stream error:', errorMessage);
        res.write(`\n\n[ERROR]: ${errorMessage}`);
      }

      res.end();
    } catch (error) {
      this.logger.error('Chat stream error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}
