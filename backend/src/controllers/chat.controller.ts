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
            // Handle permission request tool
            if (toolName === 'request_mcp_permission') {
              const { tool_name, tool_description, purpose } = parameters;
              // Return the HTML card
              return `
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin: 16px 0;">
  <div style="display: flex; align-items: center; margin-bottom: 16px;">
    <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; margin-right: 16px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7V12C2 16.55 4.84 20.74 9 22.05V19.77C6.2 18.63 4.5 15.58 4.5 12V8.3L12 4.65L19.5 8.3V12C19.5 12.63 19.38 13.23 19.2 13.79L21.26 15.85C21.73 14.64 22 13.34 22 12V7L12 2M18 14C17.87 14 17.76 14.09 17.74 14.21L17.55 15.53C17.25 15.66 16.96 15.82 16.7 16L15.46 15.5C15.35 15.5 15.22 15.5 15.15 15.63L14.15 17.36C14.09 17.47 14.11 17.6 14.21 17.68L15.27 18.5C15.25 18.67 15.24 18.83 15.24 19C15.24 19.17 15.25 19.33 15.27 19.5L14.21 20.32C14.12 20.4 14.09 20.53 14.15 20.64L15.15 22.37C15.21 22.5 15.34 22.5 15.46 22.5L16.7 22C16.96 22.18 17.24 22.35 17.55 22.47L17.74 23.79C17.76 23.91 17.86 24 18 24H20C20.11 24 20.22 23.91 20.25 23.79L20.44 22.47C20.74 22.34 21 22.18 21.27 22L22.5 22.5C22.61 22.5 22.74 22.5 22.81 22.37L23.81 20.64C23.87 20.53 23.85 20.4 23.75 20.32L22.69 19.5C22.71 19.33 22.72 19.17 22.72 19C22.72 18.83 22.71 18.67 22.69 18.5L23.75 17.68C23.84 17.6 23.87 17.47 23.81 17.36L22.81 15.63C22.75 15.5 22.62 15.5 22.5 15.5L21.27 16C21 15.82 20.75 15.66 20.44 15.53L20.25 14.21C20.22 14.09 20.11 14 20 14H18M19 17.5C19.83 17.5 20.5 18.17 20.5 19C20.5 19.83 19.83 20.5 19 20.5C18.16 20.5 17.5 19.83 17.5 19C17.5 18.17 18.17 17.5 19 17.5Z" fill="currentColor"/>
      </svg>
    </div>
    <h3 style="margin: 0; font-size: 24px; font-weight: 600;">MCP Tool Request</h3>
  </div>
  
  <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
    <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 14px;">I'd like to use the following tool:</p>
    <p style="margin: 0; font-size: 18px; font-weight: 500;">🔧 ${tool_name}</p>
    <p style="margin: 8px 0 0 0; opacity: 0.8; font-size: 14px;">${tool_description}</p>
  </div>
  
  <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px 0; font-weight: 500; font-size: 16px;">Purpose:</p>
    <p style="margin: 0; opacity: 0.9; line-height: 1.5;">${purpose}</p>
  </div>
  
  <div style="text-align: center; padding: 16px 0;">
    <p style="margin: 0; font-size: 16px; font-weight: 500;">
      Please respond with <strong>"approve"</strong> to execute this tool, or <strong>"cancel"</strong> to skip.
    </p>
  </div>
</div>`;
            }
            
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
