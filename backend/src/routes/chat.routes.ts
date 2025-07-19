import { Router } from 'express';
import { ChatController } from '@/controllers/chat.controller';

export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  router.post('/chat', (req, res) => chatController.chat(req, res));
  router.post('/chat/stream', (req, res) => chatController.chatStream(req, res));
  router.post('/chat/test-capabilities', (req, res) =>
    chatController.testModelCapabilities(req, res)
  );

  return router;
}
