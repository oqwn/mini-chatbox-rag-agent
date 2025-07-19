import { Request, Response } from 'express';
import { OpenAIService } from '@/services/openai.service';
import { MCPService } from '@/services/mcp.service';
import { PromptService } from '@/services/prompt.service';
import { Logger } from 'winston';

export class ChatController {
  constructor(
    private openAIService: OpenAIService,
    private mcpService: MCPService,
    private promptService: PromptService,
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

      // Add system message - always load prompt for testing
      let enhancedMessages = [...messages];
      const toolNames = mcpTools.map((t) => `- ${t.name}: ${t.description}`).join('\n') || 'No tools available';
      let systemPrompt: string;
      
      try {
        systemPrompt = this.promptService.getPrompt('mcp-system.md', {
          TOOL_NAMES: toolNames,
        });
        this.logger.info('Successfully loaded system prompt from file');
      } catch (error) {
        this.logger.error('Failed to load prompt from file, using fallback:', error);
        systemPrompt = `You have access to the following MCP (Model Context Protocol) tools that you can call directly:\n\n${toolNames}\n\nWhen the user asks you to use a tool, call it directly using function calling. These are not GUI tools - they are functions you can invoke to perform actions.`;
      }
      
      const systemMessage = {
        role: 'system' as const,
        content: systemPrompt,
      };

      // Add system message at the beginning if not already present
      if (enhancedMessages.length === 0 || enhancedMessages[0].role !== 'system') {
        enhancedMessages = [systemMessage, ...enhancedMessages];
      } else {
        // Append to existing system message
        enhancedMessages[0].content += '\n\n' + systemMessage.content;
      }

      const response = await this.openAIService.chat(enhancedMessages, {
        ...options,
        tools: mcpTools,
        onToolCall: async (toolName: string, parameters: any) => {
          // Find the tool and invoke it
          const tool = mcpTools.find((t) => t.name === toolName);
          if (tool) {
            this.logger.info(`Invoking MCP tool ${toolName} with parameters:`, parameters);
            try {
              const result = await this.mcpService.invokeTool(tool.serverId, toolName, parameters);
              this.logger.info(`MCP tool ${toolName} completed successfully`);
              return result;
            } catch (error) {
              this.logger.error(`MCP tool ${toolName} failed:`, error);
              throw error;
            }
          }
          throw new Error(`Tool ${toolName} not found`);
        },
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

      // Add system message - always load prompt for testing
      let enhancedMessages = [...messages];
      const toolNames = mcpTools.map((t) => `- ${t.name}: ${t.description}`).join('\n') || 'No tools available';
      let systemPrompt: string;
      
      try {
        systemPrompt = this.promptService.getPrompt('mcp-system.md', {
          TOOL_NAMES: toolNames,
        });
        this.logger.info('Successfully loaded system prompt from file');
      } catch (error) {
        this.logger.error('Failed to load prompt from file, using fallback:', error);
        systemPrompt = `You have access to the following MCP (Model Context Protocol) tools that you can call directly:\n\n${toolNames}\n\nWhen the user asks you to use a tool, call it directly using function calling. These are not GUI tools - they are functions you can invoke to perform actions.`;
      }
      
      const systemMessage = {
        role: 'system' as const,
        content: systemPrompt,
      };

      // Add system message at the beginning if not already present
      if (enhancedMessages.length === 0 || enhancedMessages[0].role !== 'system') {
        enhancedMessages = [systemMessage, ...enhancedMessages];
      } else {
        // Append to existing system message
        enhancedMessages[0].content += '\n\n' + systemMessage.content;
      }

      try {
        let chunkCount = 0;
        for await (const chunk of this.openAIService.chatStream(enhancedMessages, {
          ...options,
          tools: mcpTools,
          onToolCall: async (toolName: string, parameters: any) => {
            // Find the tool and invoke it
            const tool = mcpTools.find((t) => t.name === toolName);
            if (tool) {
              this.logger.info(`Invoking MCP tool ${toolName} with parameters:`, parameters);
              try {
                const result = await this.mcpService.invokeTool(
                  tool.serverId,
                  toolName,
                  parameters
                );
                this.logger.info(`MCP tool ${toolName} completed successfully`);
                return result;
              } catch (error) {
                this.logger.error(`MCP tool ${toolName} failed:`, error);
                throw error;
              }
            }
            throw new Error(`Tool ${toolName} not found`);
          },
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

  public async testModelCapabilities(req: Request, res: Response): Promise<void> {
    try {
      const { model } = req.body;

      if (!model || typeof model !== 'string') {
        res.status(400).json({ error: 'Model name is required' });
        return;
      }

      if (!this.openAIService.isConfigured()) {
        res
          .status(503)
          .json({ error: 'AI service not configured. Please set up API key in settings.' });
        return;
      }

      const result = await this.openAIService.testModelCapabilities(model);
      res.json(result);
    } catch (error) {
      this.logger.error('Model capability test error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}
