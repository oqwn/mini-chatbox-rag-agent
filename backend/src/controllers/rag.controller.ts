import { Request, Response } from 'express';
import { Logger } from 'winston';
import { VectorDbService } from '@/services/vector-db.service';
import { EmbeddingService } from '@/services/embedding.service';
import { DocumentIngestionService } from '@/services/document-ingestion.service';
import { RagRetrievalService } from '@/services/rag-retrieval.service';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.json', '.csv', '.log'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: .txt, .md, .json, .csv, .log'));
    }
  },
});

export class RagController {
  constructor(
    private vectorDbService: VectorDbService,
    private embeddingService: EmbeddingService,
    private documentIngestionService: DocumentIngestionService,
    private ragRetrievalService: RagRetrievalService,
    private logger: Logger
  ) {}

  // Knowledge Sources
  public async createKnowledgeSource(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, sourceType, config } = req.body;

      if (!name || !sourceType) {
        res.status(400).json({ error: 'Name and sourceType are required' });
        return;
      }

      const id = await this.vectorDbService.createKnowledgeSource({
        name,
        description,
        sourceType,
        config,
      });

      res.json({ id, message: 'Knowledge source created successfully' });
    } catch (error) {
      this.logger.error('Failed to create knowledge source:', error);
      res.status(500).json({ error: 'Failed to create knowledge source' });
    }
  }

  public async getKnowledgeSources(_req: Request, res: Response): Promise<void> {
    try {
      const sources = await this.vectorDbService.getKnowledgeSources();
      res.json({ sources });
    } catch (error) {
      this.logger.error('Failed to get knowledge sources:', error);
      res.status(500).json({ error: 'Failed to get knowledge sources' });
    }
  }

  // Document Ingestion
  public async ingestText(req: Request, res: Response): Promise<void> {
    try {
      const { content, title, knowledgeSourceId, metadata } = req.body;

      if (!content || !title) {
        res.status(400).json({ error: 'Content and title are required' });
        return;
      }

      const result = await this.documentIngestionService.ingestText(content, title, {
        knowledgeSourceId,
        metadata,
      });

      res.json({
        success: true,
        documentId: result.documentId,
        chunksCreated: result.chunksCreated,
        totalTokens: result.totalTokens,
        processingTime: result.processingTime,
      });
    } catch (error) {
      this.logger.error('Failed to ingest text:', error);
      res.status(500).json({ error: 'Failed to ingest text' });
    }
  }

  public ingestFile = upload.single('file');

  public async handleFileIngestion(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { knowledgeSourceId, metadata } = req.body;
      const filePath = req.file.path;

      try {
        const result = await this.documentIngestionService.ingestFile(filePath, {
          knowledgeSourceId: knowledgeSourceId ? parseInt(knowledgeSourceId) : undefined,
          metadata: metadata ? JSON.parse(metadata) : undefined,
        });

        res.json({
          success: true,
          documentId: result.documentId,
          chunksCreated: result.chunksCreated,
          totalTokens: result.totalTokens,
          processingTime: result.processingTime,
        });
      } finally {
        // Clean up uploaded file
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          this.logger.warn('Failed to clean up uploaded file:', cleanupError);
        }
      }
    } catch (error) {
      this.logger.error('Failed to ingest file:', error);
      res.status(500).json({ error: 'Failed to ingest file' });
    }
  }

  // Document Management
  public async getDocuments(req: Request, res: Response): Promise<void> {
    try {
      const { knowledgeSourceId } = req.query;
      const documents = await this.vectorDbService.getDocuments(
        knowledgeSourceId ? parseInt(knowledgeSourceId as string) : undefined
      );
      res.json({ documents });
    } catch (error) {
      this.logger.error('Failed to get documents:', error);
      res.status(500).json({ error: 'Failed to get documents' });
    }
  }

  public async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const document = await this.vectorDbService.getDocument(parseInt(id));

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({ document });
    } catch (error) {
      this.logger.error('Failed to get document:', error);
      res.status(500).json({ error: 'Failed to get document' });
    }
  }

  public async deleteDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.vectorDbService.deleteDocument(parseInt(id));
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      this.logger.error('Failed to delete document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }

  public async getDocumentChunks(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const chunks = await this.vectorDbService.getDocumentChunks(parseInt(id));
      res.json({ chunks });
    } catch (error) {
      this.logger.error('Failed to get document chunks:', error);
      res.status(500).json({ error: 'Failed to get document chunks' });
    }
  }

  // Search and Retrieval
  public async search(req: Request, res: Response): Promise<void> {
    try {
      const {
        query,
        knowledgeSourceId,
        maxResults = 5,
        similarityThreshold = 0.7,
        useHybridSearch = true,
        contextWindowSize = 2,
      } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const result = await this.ragRetrievalService.retrieveContext({
        query,
        knowledgeSourceId,
        maxResults,
        similarityThreshold,
        useHybridSearch,
        contextWindowSize,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      this.logger.error('Failed to perform search:', error);
      res.status(500).json({ error: 'Failed to perform search' });
    }
  }

  public async similaritySearch(req: Request, res: Response): Promise<void> {
    try {
      const { query, knowledgeSourceId, limit = 5, threshold = 0.7 } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

      // Perform similarity search
      const results = await this.vectorDbService.similaritySearch(
        queryEmbedding.embedding,
        limit,
        threshold,
        knowledgeSourceId
      );

      res.json({
        success: true,
        results,
        query,
        resultsCount: results.length,
      });
    } catch (error) {
      this.logger.error('Failed to perform similarity search:', error);
      res.status(500).json({ error: 'Failed to perform similarity search' });
    }
  }

  // System Information
  public async getSystemInfo(_req: Request, res: Response): Promise<void> {
    try {
      const [dbStats, embeddingInfo, retrievalStats] = await Promise.all([
        this.vectorDbService.getStats(),
        this.embeddingService.getModelInfo(),
        this.ragRetrievalService.getRetrievalStats(),
      ]);

      res.json({
        database: dbStats,
        embedding: {
          ...embeddingInfo,
          isConfigured: this.embeddingService.isConfigured(),
        },
        retrieval: retrievalStats,
        system: {
          status: 'ready',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to get system info:', error);
      res.status(500).json({ error: 'Failed to get system info' });
    }
  }

  public async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      // Test database connection
      const dbStats = await this.vectorDbService.getStats();

      // Test embedding service
      const embeddingConfigured = this.embeddingService.isConfigured();

      // Test retrieval
      const retrievalTest = await this.ragRetrievalService.testRetrieval('test query');

      const isHealthy = embeddingConfigured && retrievalTest.success;

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: 'ok',
            documents: dbStats.documentsCount,
            chunks: dbStats.chunksCount,
          },
          embedding: {
            status: embeddingConfigured ? 'ok' : 'error',
            configured: embeddingConfigured,
          },
          retrieval: {
            status: retrievalTest.success ? 'ok' : 'error',
            testTime: retrievalTest.time,
            error: retrievalTest.error,
          },
        },
      });
    } catch (error) {
      this.logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Utility endpoints
  public async generateEmbedding(req: Request, res: Response): Promise<void> {
    try {
      const { text } = req.body;

      if (!text) {
        res.status(400).json({ error: 'Text is required' });
        return;
      }

      const result = await this.embeddingService.generateEmbedding({ text });

      res.json({
        success: true,
        embedding: result.embedding,
        dimensions: result.embedding.length,
        tokenCount: result.tokenCount,
      });
    } catch (error) {
      this.logger.error('Failed to generate embedding:', error);
      res.status(500).json({ error: 'Failed to generate embedding' });
    }
  }
}
