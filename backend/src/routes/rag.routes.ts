import { Router } from 'express';
import { RagController } from '@/controllers/rag.controller';

export function createRagRoutes(ragController: RagController): Router {
  const router = Router();

  // System endpoints
  router.get('/health', ragController.healthCheck.bind(ragController));
  router.get('/info', ragController.getSystemInfo.bind(ragController));

  // Configuration endpoints
  router.get('/config', ragController.getRagConfiguration.bind(ragController));
  router.put('/config', ragController.updateRagConfiguration.bind(ragController));

  // Knowledge sources
  router.post('/knowledge-sources', ragController.createKnowledgeSource.bind(ragController));
  router.get('/knowledge-sources', ragController.getKnowledgeSources.bind(ragController));

  // Document ingestion
  router.post('/ingest/text', ragController.ingestText.bind(ragController));
  router.post(
    '/ingest/file',
    ragController.ingestFile,
    ragController.handleFileIngestion.bind(ragController)
  );

  // Process file for chat (without storing in knowledge base)
  router.post(
    '/process/chat-file',
    ragController.ingestFile,
    ragController.processChatFile.bind(ragController)
  );

  // Document management
  router.get('/documents', ragController.getDocuments.bind(ragController));
  router.get('/documents/:id', ragController.getDocument.bind(ragController));
  router.delete('/documents/:id', ragController.deleteDocument.bind(ragController));
  router.put('/documents/:id/move', ragController.moveDocument.bind(ragController));
  router.get('/documents/:id/chunks', ragController.getDocumentChunks.bind(ragController));

  // Search and retrieval
  router.post('/search', ragController.search.bind(ragController));
  router.post('/similarity-search', ragController.similaritySearch.bind(ragController));

  // Utility
  router.post('/embedding', ragController.generateEmbedding.bind(ragController));

  // Multimodal endpoints
  router.get('/media/info', ragController.getMediaInfo.bind(ragController));
  router.post(
    '/media/validate',
    ragController.validateMediaFile_upload,
    ragController.validateMediaFile.bind(ragController)
  );

  return router;
}
