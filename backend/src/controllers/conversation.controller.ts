import { Request, Response } from 'express';
import { ConversationMemoryService } from '../services/conversation-memory.service';
import { Logger } from 'winston';

export class ConversationController {
  constructor(
    private conversationMemoryService: ConversationMemoryService,
    private logger: Logger
  ) {}

  // Get all conversations with pagination
  getConversations = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const conversations = await this.conversationMemoryService.getConversations(limit, offset);
      const stats = await this.conversationMemoryService.getMemoryStats();

      res.json({
        conversations,
        pagination: {
          limit,
          offset,
          total: stats.totalConversations,
        },
        stats,
      });
    } catch (error) {
      this.logger.error('Error getting conversations:', error);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  };

  // Get specific conversation
  getConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const conversation = await this.conversationMemoryService.getConversation(sessionId);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.json({ conversation });
    } catch (error) {
      this.logger.error('Error getting conversation:', error);
      res.status(500).json({ error: 'Failed to get conversation' });
    }
  };

  // Create new conversation
  createConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, title, contextWindowSize } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      // Check if conversation already exists
      const existing = await this.conversationMemoryService.getConversation(sessionId);
      if (existing) {
        res.status(409).json({ error: 'Conversation already exists' });
        return;
      }

      const conversationId = await this.conversationMemoryService.createConversation({
        sessionId,
        title,
        contextWindowSize,
      });

      const conversation = await this.conversationMemoryService.getConversationById(conversationId);
      res.status(201).json({ conversation });
    } catch (error) {
      this.logger.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  // Update conversation
  updateConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const updates = req.body;

      await this.conversationMemoryService.updateConversation(sessionId, updates);
      const conversation = await this.conversationMemoryService.getConversation(sessionId);

      res.json({ conversation });
    } catch (error) {
      this.logger.error('Error updating conversation:', error);
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  };

  // Get conversation messages
  getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const tokenLimit = req.query.tokenLimit ? parseInt(req.query.tokenLimit as string) : undefined;
      const importanceThreshold = req.query.importanceThreshold ? parseFloat(req.query.importanceThreshold as string) : undefined;

      const conversation = await this.conversationMemoryService.getConversation(sessionId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      let messages;
      if (tokenLimit) {
        // Get recent messages within token limit
        messages = await this.conversationMemoryService.getRecentMessages(
          conversation.id!,
          tokenLimit
        );
      } else if (importanceThreshold) {
        // Get important messages
        messages = await this.conversationMemoryService.getImportantMessages(
          conversation.id!,
          importanceThreshold,
          limit || 20
        );
      } else {
        // Get all messages with pagination
        messages = await this.conversationMemoryService.getMessages(
          conversation.id!,
          limit,
          offset
        );
      }

      res.json({ messages });
    } catch (error) {
      this.logger.error('Error getting messages:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  };

  // Add message to conversation
  addMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { role, content, metadata, tokenCount, importanceScore } = req.body;

      if (!role || !content) {
        res.status(400).json({ error: 'Role and content are required' });
        return;
      }

      let conversation = await this.conversationMemoryService.getConversation(sessionId);
      if (!conversation) {
        // Create conversation if it doesn't exist
        const conversationId = await this.conversationMemoryService.createConversation({
          sessionId,
          title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
        });
        conversation = await this.conversationMemoryService.getConversationById(conversationId);
      }

      const messageId = await this.conversationMemoryService.addMessage({
        conversationId: conversation!.id!,
        role,
        content,
        metadata,
        tokenCount,
        importanceScore,
      });

      res.status(201).json({ messageId });
    } catch (error) {
      this.logger.error('Error adding message:', error);
      res.status(500).json({ error: 'Failed to add message' });
    }
  };

  // Get conversation summaries
  getSummaries = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      const conversation = await this.conversationMemoryService.getConversation(sessionId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const summaries = await this.conversationMemoryService.getSummaries(conversation.id!);
      res.json({ summaries });
    } catch (error) {
      this.logger.error('Error getting summaries:', error);
      res.status(500).json({ error: 'Failed to get summaries' });
    }
  };

  // Create conversation summary
  createSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { summaryText, messageRangeStart, messageRangeEnd, tokenCount, compressionRatio } = req.body;

      if (!summaryText) {
        res.status(400).json({ error: 'Summary text is required' });
        return;
      }

      const conversation = await this.conversationMemoryService.getConversation(sessionId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const summaryId = await this.conversationMemoryService.createSummary({
        conversationId: conversation.id!,
        summaryText,
        messageRangeStart,
        messageRangeEnd,
        tokenCount,
        compressionRatio,
      });

      res.status(201).json({ summaryId });
    } catch (error) {
      this.logger.error('Error creating summary:', error);
      res.status(500).json({ error: 'Failed to create summary' });
    }
  };

  // Prune old messages
  pruneMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { keepRecentCount } = req.body;

      const conversation = await this.conversationMemoryService.getConversation(sessionId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const pruningLog = await this.conversationMemoryService.pruneOldMessages(
        conversation.id!,
        keepRecentCount || 50
      );

      res.json({ pruningLog });
    } catch (error) {
      this.logger.error('Error pruning messages:', error);
      res.status(500).json({ error: 'Failed to prune messages' });
    }
  };

  // Get memory cache
  getCache = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const data = await this.conversationMemoryService.getCache(key);

      if (data === null) {
        res.status(404).json({ error: 'Cache entry not found' });
        return;
      }

      res.json({ data });
    } catch (error) {
      this.logger.error('Error getting cache:', error);
      res.status(500).json({ error: 'Failed to get cache' });
    }
  };

  // Set memory cache
  setCache = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const { data, ttlMinutes } = req.body;

      if (data === undefined) {
        res.status(400).json({ error: 'Data is required' });
        return;
      }

      await this.conversationMemoryService.setCache(key, data, ttlMinutes);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Error setting cache:', error);
      res.status(500).json({ error: 'Failed to set cache' });
    }
  };

  // Get context window
  getContextWindow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;

      const conversation = await this.conversationMemoryService.getConversation(sessionId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const contextWindow = await this.conversationMemoryService.getActiveContextWindow(
        conversation.id!
      );

      res.json({ contextWindow });
    } catch (error) {
      this.logger.error('Error getting context window:', error);
      res.status(500).json({ error: 'Failed to get context window' });
    }
  };

  // Create context window
  createContextWindow = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { windowStart, windowEnd, tokenCount } = req.body;

      if (windowStart === undefined || windowEnd === undefined || !tokenCount) {
        res.status(400).json({ error: 'Window start, end, and token count are required' });
        return;
      }

      const conversation = await this.conversationMemoryService.getConversation(sessionId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const contextWindowId = await this.conversationMemoryService.createContextWindow({
        conversationId: conversation.id!,
        windowStart,
        windowEnd,
        tokenCount,
      });

      res.status(201).json({ contextWindowId });
    } catch (error) {
      this.logger.error('Error creating context window:', error);
      res.status(500).json({ error: 'Failed to create context window' });
    }
  };

  // Get memory statistics
  getStats = async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.conversationMemoryService.getMemoryStats();
      res.json({ stats });
    } catch (error) {
      this.logger.error('Error getting memory stats:', error);
      res.status(500).json({ error: 'Failed to get memory stats' });
    }
  };
}