import { Request, Response } from 'express';
import { OpenAIService } from '@/services/openai.service';
import { MCPService } from '@/services/mcp.service';
import { PromptService } from '@/services/prompt.service';
import { RagRetrievalService } from '@/services/rag-retrieval.service';
import { VectorDbService } from '@/services/vector-db.service';
import { Logger } from 'winston';

export class ChatController {
  constructor(
    private openAIService: OpenAIService,
    private mcpService: MCPService,
    private promptService: PromptService,
    private ragRetrievalService: RagRetrievalService,
    private vectorDbService: VectorDbService,
    private logger: Logger
  ) {}

  private async getKnowledgeBaseSources(): Promise<{
    hasDocuments: boolean;
    knowledgeSourceIds: number[];
  }> {
    try {
      const sources = await this.vectorDbService.getKnowledgeSources();
      const knowledgeSourceIds = sources.map((s) => s.id!).filter((id) => id !== undefined);
      const hasDocuments = knowledgeSourceIds.length > 0;
      return { hasDocuments, knowledgeSourceIds };
    } catch (error) {
      this.logger.error('Failed to get knowledge sources:', error);
      return { hasDocuments: false, knowledgeSourceIds: [] };
    }
  }

  private async performRagRetrieval(query: string): Promise<{
    contextText: string;
    references: any[];
    retrievalTime: number;
    usedFallback: boolean;
  } | null> {
    try {
      const startTime = Date.now();
      const { hasDocuments, knowledgeSourceIds } = await this.getKnowledgeBaseSources();

      if (!hasDocuments || knowledgeSourceIds.length === 0) {
        this.logger.debug('No documents in knowledge base, skipping RAG retrieval');
        return null;
      }

      this.logger.debug(`Performing RAG retrieval for query: ${query.substring(0, 100)}...`);

      // Check if retrieval is taking too long and potentially fall back
      const EMBEDDING_TIMEOUT = 5000; // 5 seconds
      let usedFallback = false;

      try {
        const ragResult = (await Promise.race([
          this.ragRetrievalService.retrieveContext({
            query,
            maxResults: 5,
            similarityThreshold: 0.3,
            useReranking: true,
            rerankTopK: 10,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Embedding timeout')), EMBEDDING_TIMEOUT)
          ),
        ])) as any;

        const retrievalTime = Date.now() - startTime;

        if (ragResult.relevantChunks.length === 0) {
          this.logger.debug('No relevant chunks found in knowledge base');
          return null;
        }

        // Format references for citation with enhanced metadata
        const references = ragResult.relevantChunks.map((chunk: any, index: number) => ({
          id: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle || `Document ${chunk.documentId}`,
          exactPreview:
            chunk.chunkMetadata?.exactPreview ||
            chunk.chunkText.substring(0, 300) + (chunk.chunkText.length > 300 ? '...' : ''),
          similarity: chunk.similarity,
          citationNumber: index + 1,
          rerankScore: chunk.rerankScore,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.chunkMetadata?.pageNumber,
          pageNumbers: chunk.chunkMetadata?.pageNumbers || [],
          startPage: chunk.chunkMetadata?.startPage,
          endPage: chunk.chunkMetadata?.endPage,
          wordCount: chunk.chunkText.split(/\s+/).length,
          contextBefore: chunk.contextBefore,
          contextAfter: chunk.contextAfter,
        }));

        this.logger.info(
          `RAG retrieved ${references.length} relevant chunks in ${retrievalTime}ms`
        );

        return {
          contextText: ragResult.contextText,
          references,
          retrievalTime,
          usedFallback,
        };
      } catch (timeoutError) {
        // Fallback to keyword search if embedding is slow
        this.logger.warn('Embedding timeout, falling back to keyword search');
        usedFallback = true;

        // Simplified keyword search fallback
        const fallbackResult = await this.ragRetrievalService.retrieveContext({
          query,
          maxResults: 5,
          similarityThreshold: 0.2,
          useReranking: false, // Skip reranking for faster results
          rerankTopK: 5,
        });

        const retrievalTime = Date.now() - startTime;

        if (fallbackResult.relevantChunks.length === 0) {
          this.logger.debug('No relevant chunks found with fallback search');
          return null;
        }

        const references = fallbackResult.relevantChunks.map((chunk: any, index: number) => ({
          id: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle || `Document ${chunk.documentId}`,
          exactPreview:
            chunk.chunkMetadata?.exactPreview ||
            chunk.chunkText.substring(0, 300) + (chunk.chunkText.length > 300 ? '...' : ''),
          similarity: chunk.similarity,
          citationNumber: index + 1,
          rerankScore: chunk.rerankScore,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.chunkMetadata?.pageNumber,
          pageNumbers: chunk.chunkMetadata?.pageNumbers || [],
          startPage: chunk.chunkMetadata?.startPage,
          endPage: chunk.chunkMetadata?.endPage,
          wordCount: chunk.chunkText.split(/\s+/).length,
          contextBefore: chunk.contextBefore,
          contextAfter: chunk.contextAfter,
        }));

        this.logger.info(
          `RAG fallback retrieved ${references.length} relevant chunks in ${retrievalTime}ms`
        );

        return {
          contextText: fallbackResult.contextText,
          references,
          retrievalTime,
          usedFallback,
        };
      }
    } catch (error) {
      this.logger.error('RAG retrieval failed:', error);
      return null;
    }
  }

  public async chat(req: Request, res: Response): Promise<void> {
    try {
      const { messages, options, ragEnabled, mcpAutoApprove } = req.body;

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
      this.logger.info(`Found ${mcpTools.length} MCP tools available`);

      // Perform RAG retrieval for the latest user message
      let ragContext: {
        contextText: string;
        references: any[];
        retrievalTime: number;
        usedFallback: boolean;
      } | null = null;
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMessage?.content && ragEnabled === true) {
        ragContext = await this.performRagRetrieval(lastUserMessage.content);
      }

      // Check for multimodal attachments in the last user message
      let multimodalContext = '';
      if (lastUserMessage?.attachments && lastUserMessage.attachments.length > 0) {
        multimodalContext = this.buildMultimodalContext(lastUserMessage.attachments);
        this.logger.info(
          `Added multimodal context for ${lastUserMessage.attachments.length} attachments`
        );
      }

      // Check if the last assistant message contains a permission request
      let additionalContext = '';
      if (messages.length >= 2) {
        const lastAssistantMsg = messages[messages.length - 2];
        const lastUserMsg = messages[messages.length - 1];

        if (
          lastAssistantMsg.role === 'assistant' &&
          lastAssistantMsg.content.includes('[MCP_PERMISSION_REQUEST]') &&
          lastUserMsg.role === 'user'
        ) {
          const userResponse = lastUserMsg.content.toLowerCase();
          const isApproved = 
            mcpAutoApprove || 
            ['approve', 'yes', 'ok', 'sure', 'go ahead'].some((word) => userResponse.includes(word));
          
          if (isApproved) {
            // Extract tool name from permission request
            const toolMatch = lastAssistantMsg.content.match(/TOOL:\s*(.+?)\s*(?:DESCRIPTION|$)/);
            if (toolMatch) {
              try {
                additionalContext =
                  '\n\n' +
                  this.promptService.getPrompt('mcp-permission-approved.md', {
                    TOOL_NAME: toolMatch[1].trim(),
                  });
                
                if (mcpAutoApprove) {
                  this.logger.info(`Auto-approved MCP tool: ${toolMatch[1].trim()}`);
                } else {
                  this.logger.info(`User approved MCP tool: ${toolMatch[1].trim()}`);
                }
              } catch (error) {
                this.logger.warn(
                  'Failed to load permission approved prompt, using fallback:',
                  error
                );
                const approvalType = mcpAutoApprove ? 'auto-approved' : 'approved';
                additionalContext = `\n\nIMPORTANT: The user ${approvalType} your request to use "${toolMatch[1].trim()}". You MUST call this tool NOW in your response and show the results.`;
              }
            }
          }
        }
      }

      // Add system message - always load prompt for testing
      let enhancedMessages = [...messages];
      const toolNames =
        mcpTools.map((t) => `- ${t.name}: ${t.description}`).join('\n') || 'No tools available';
      this.logger.info(`Tool names for prompt: ${toolNames}`);
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

      // Add RAG context to system prompt if available
      let ragSystemPrompt = '';
      if (ragContext) {
        try {
          const retrievalMethod = ragContext.usedFallback ? 'keyword search' : 'semantic search';
          const timingInfo = `Retrieval completed in ${ragContext.retrievalTime}ms using ${retrievalMethod}`;

          ragSystemPrompt = this.promptService.getPrompt('rag-tool-system.md', {
            CONTEXT_TEXT: ragContext.contextText,
            RETRIEVAL_TIME: ragContext.retrievalTime.toString(),
            RETRIEVAL_METHOD: retrievalMethod,
            TIMING_INFO: timingInfo,
            USED_FALLBACK: ragContext.usedFallback.toString(),
          });
        } catch (error) {
          this.logger.warn('Failed to load RAG tool prompt from file, using fallback:', error);
          const retrievalMethod = ragContext.usedFallback ? 'keyword search' : 'semantic search';
          ragSystemPrompt = `\n\n=== RAG TOOL INFORMATION ===\nRetrieval completed in ${ragContext.retrievalTime}ms using ${retrievalMethod}\n${ragContext.usedFallback ? 'Note: Used fallback search due to slow embedding' : ''}\n\n=== KNOWLEDGE BASE CONTEXT ===\n${ragContext.contextText}\n=== END KNOWLEDGE BASE CONTEXT ===\n\nYou just used the RAG tool to search the knowledge base. Communicate this transparently to the user with timing information.`;
        }
      }

      const systemMessage = {
        role: 'system' as const,
        content: systemPrompt + additionalContext + ragSystemPrompt + multimodalContext,
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

      // Include RAG references in response if available
      const responseWithReferences = {
        message: response,
        ragReferences: ragContext?.references || null,
        ragUsed: ragContext !== null,
      };

      res.json(responseWithReferences);
    } catch (error) {
      this.logger.error('Chat error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  public async chatStream(req: Request, res: Response): Promise<void> {
    try {
      const { messages, options, ragEnabled, mcpAutoApprove } = req.body;

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
      this.logger.info(`Found ${mcpTools.length} MCP tools available`);

      // Perform RAG retrieval for the latest user message
      let ragContext: {
        contextText: string;
        references: any[];
        retrievalTime: number;
        usedFallback: boolean;
      } | null = null;
      const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
      if (lastUserMessage?.content && ragEnabled === true) {
        this.logger.info(`Performing RAG retrieval for: ${lastUserMessage.content}`);
        ragContext = await this.performRagRetrieval(lastUserMessage.content);
        this.logger.info(`RAG retrieval result: ${ragContext ? 'SUCCESS' : 'FAILED'}`);
      }

      // Check for multimodal attachments in the last user message
      let multimodalContext = '';
      if (lastUserMessage?.attachments && lastUserMessage.attachments.length > 0) {
        multimodalContext = this.buildMultimodalContext(lastUserMessage.attachments);
        this.logger.info(
          `Added multimodal context for ${lastUserMessage.attachments.length} attachments`
        );
      }

      // Check if the last assistant message contains a permission request
      let additionalContext = '';
      if (messages.length >= 2) {
        const lastAssistantMsg = messages[messages.length - 2];
        const lastUserMsg = messages[messages.length - 1];

        if (
          lastAssistantMsg.role === 'assistant' &&
          lastAssistantMsg.content.includes('[MCP_PERMISSION_REQUEST]') &&
          lastUserMsg.role === 'user'
        ) {
          const userResponse = lastUserMsg.content.toLowerCase();
          const isApproved = 
            mcpAutoApprove || 
            ['approve', 'yes', 'ok', 'sure', 'go ahead'].some((word) => userResponse.includes(word));
          
          if (isApproved) {
            // Extract tool name from permission request
            const toolMatch = lastAssistantMsg.content.match(/TOOL:\s*(.+?)\s*(?:DESCRIPTION|$)/);
            if (toolMatch) {
              try {
                additionalContext =
                  '\n\n' +
                  this.promptService.getPrompt('mcp-permission-approved.md', {
                    TOOL_NAME: toolMatch[1].trim(),
                  });
                
                if (mcpAutoApprove) {
                  this.logger.info(`Auto-approved MCP tool: ${toolMatch[1].trim()}`);
                } else {
                  this.logger.info(`User approved MCP tool: ${toolMatch[1].trim()}`);
                }
              } catch (error) {
                this.logger.warn(
                  'Failed to load permission approved prompt, using fallback:',
                  error
                );
                const approvalType = mcpAutoApprove ? 'auto-approved' : 'approved';
                additionalContext = `\n\nIMPORTANT: The user ${approvalType} your request to use "${toolMatch[1].trim()}". You MUST call this tool NOW in your response and show the results.`;
              }
            }
          }
        }
      }

      // Add system message - always load prompt for testing
      let enhancedMessages = [...messages];
      const toolNames =
        mcpTools.map((t) => `- ${t.name}: ${t.description}`).join('\n') || 'No tools available';
      this.logger.info(`Tool names for prompt: ${toolNames}`);
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

      // Add RAG context to system prompt if available
      let ragSystemPrompt = '';
      if (ragContext) {
        try {
          const retrievalMethod = ragContext.usedFallback ? 'keyword search' : 'semantic search';
          const timingInfo = `Retrieval completed in ${ragContext.retrievalTime}ms using ${retrievalMethod}`;

          ragSystemPrompt = this.promptService.getPrompt('rag-tool-system.md', {
            CONTEXT_TEXT: ragContext.contextText,
            RETRIEVAL_TIME: ragContext.retrievalTime.toString(),
            RETRIEVAL_METHOD: retrievalMethod,
            TIMING_INFO: timingInfo,
            USED_FALLBACK: ragContext.usedFallback.toString(),
          });
        } catch (error) {
          this.logger.warn('Failed to load RAG tool prompt from file, using fallback:', error);
          const retrievalMethod = ragContext.usedFallback ? 'keyword search' : 'semantic search';
          ragSystemPrompt = `\n\n=== RAG TOOL INFORMATION ===\nRetrieval completed in ${ragContext.retrievalTime}ms using ${retrievalMethod}\n${ragContext.usedFallback ? 'Note: Used fallback search due to slow embedding' : ''}\n\n=== KNOWLEDGE BASE CONTEXT ===\n${ragContext.contextText}\n=== END KNOWLEDGE BASE CONTEXT ===\n\nYou just used the RAG tool to search the knowledge base. Communicate this transparently to the user with timing information.`;
        }
      }

      const systemMessage = {
        role: 'system' as const,
        content: systemPrompt + additionalContext + ragSystemPrompt + multimodalContext,
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

        // References are now handled via inline citations in the AI response
        // No longer appending a separate references section
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

  /**
   * Build multimodal context from message attachments
   */
  private buildMultimodalContext(attachments: any[]): string {
    if (!attachments || attachments.length === 0) {
      return '';
    }

    let context = '\n\n=== MULTIMODAL ATTACHMENTS ===\n';
    context += `The user has attached ${attachments.length} file(s) to their message:\n\n`;

    attachments.forEach((attachment, index) => {
      context += `**Attachment ${index + 1}: ${attachment.name}**\n`;
      context += `- Type: ${attachment.type}\n`;
      context += `- Size: ${this.formatFileSize(attachment.size)}\n`;

      if (attachment.analysis) {
        if (attachment.analysis.extractedText) {
          context += `- Extracted Text: ${attachment.analysis.extractedText.substring(0, 500)}${attachment.analysis.extractedText.length > 500 ? '...' : ''}\n`;
        }

        if (attachment.analysis.description) {
          context += `- Analysis: ${attachment.analysis.description}\n`;
        }

        if (attachment.analysis.metadata) {
          const metadata = JSON.stringify(attachment.analysis.metadata);
          context += `- Metadata: ${metadata.substring(0, 200)}${metadata.length > 200 ? '...' : ''}\n`;
        }
      }

      context += '\n';
    });

    context += '=== END MULTIMODAL ATTACHMENTS ===\n\n';

    // Add specific guidance for handling attachments
    context += '**IMPORTANT INSTRUCTIONS FOR HANDLING ATTACHMENTS:**\n\n';

    context +=
      '1. **OCR/Text Extraction**: When images contain text (screenshots, documents, etc.), the text has been automatically extracted and is shown in the "Extracted Text" field above.\n\n';

    context += '2. **When user asks to extract text from image**, present it in this format:\n\n';
    context += '<details>\n';
    context += '<summary>📝 Extracted Text from Image</summary>\n\n';
    context += '**OCR Processing:**\n';
    context += '- Status: [Successful/Partial/Failed]\n';
    context += '- Text Quality: [Clear/Readable/Poor]\n';
    context += '- Language: [English/Chinese/Mixed/Other]\n\n';
    context += '**Extracted Content:**\n';
    context += '```\n';
    context += '[Show the full extracted text here]\n';
    context += '```\n\n';
    context += '**Summary:**\n';
    context += '[2-3 sentence summary of the extracted text]\n\n';
    context += '**Key Points:**\n';
    context += '- [Important point 1]\n';
    context += '- [Important point 2]\n';
    context += '- [Important point 3]\n';
    context += '</details>\n\n';

    context += '3. **OCR Capabilities**:\n';
    context += '   - Supports English, Simplified Chinese, and Traditional Chinese\n';
    context += '   - Pre-processes images for better accuracy\n';
    context += '   - Works best with clear text on contrasting backgrounds\n\n';

    context += '4. **General Guidelines**:\n';
    context += '   - Always acknowledge what the user has shared\n';
    context += '   - Focus on the extracted text content when answering questions\n';
    context += '   - Quote or reference specific extracted text in responses\n';
    context += '   - Be precise - use the exact extracted text\n';
    context += '   - If OCR quality is poor, suggest image improvements\n\n';

    context +=
      'The user has shared these files with you. Analyze and respond appropriately, making full use of any extracted text content.\n';

    return context;
  }

  /**
   * Format file size in human readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
