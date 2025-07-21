import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { ConversationMemoryService } from '../services/conversation-memory.service';
import winston from 'winston';

const router = Router();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Initialize services
const conversationMemoryService = new ConversationMemoryService(logger);
const conversationController = new ConversationController(conversationMemoryService, logger);

// Conversation routes
router.get('/', conversationController.getConversations);
router.post('/', conversationController.createConversation);
router.get('/stats', conversationController.getStats);

// Specific conversation routes
router.get('/:sessionId', conversationController.getConversation);
router.put('/:id', conversationController.updateConversation);

// Message routes
router.get('/:sessionId/messages', conversationController.getMessages);
router.post('/:sessionId/messages', conversationController.addMessage);

// Summary routes
router.get('/:sessionId/summaries', conversationController.getSummaries);
router.post('/:sessionId/summaries', conversationController.createSummary);

// Pruning routes
router.post('/:sessionId/prune', conversationController.pruneMessages);

// Context window routes
router.get('/:sessionId/context-window', conversationController.getContextWindow);
router.post('/:sessionId/context-window', conversationController.createContextWindow);

// Cache routes
router.get('/cache/:key', conversationController.getCache);
router.post('/cache/:key', conversationController.setCache);

export default router;
