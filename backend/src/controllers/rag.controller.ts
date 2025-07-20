import { Request, Response } from 'express';
import { Logger } from 'winston';
import { ConfigService } from '@/services/config.service';
import { VectorDbService } from '@/services/vector-db.service';
import { IEmbeddingService } from '@/services/embedding-factory.service';
import { DocumentIngestionService } from '@/services/document-ingestion.service';
import { RagRetrievalService } from '@/services/rag-retrieval.service';
import { MultimodalFactoryService } from '@/services/multimodal-factory.service';
import multer from 'multer';
import { promises as fs } from 'fs';
import { FILE_CONFIG, getAllSupportedExtensions, getFileExtension } from '../config/file-types';

// Utility function to fix UTF-8 encoding issues in filenames
function fixFilenameEncoding(filename: string): string {
  try {
    // Check if filename appears to be mis-encoded UTF-8 (common with Chinese characters)
    const decoded = Buffer.from(filename, 'latin1').toString('utf8');

    // Simple heuristic: if decoded version has fewer replacement characters, use it
    // Also check if the decoded version contains valid Chinese characters
    const hasChineseChars = /[\u4e00-\u9fff]/.test(decoded);
    const hasFewerReplacementChars =
      decoded.split('\ufffd').length < filename.split('\ufffd').length;

    if (hasChineseChars || hasFewerReplacementChars) {
      return decoded;
    }
  } catch (error) {
    // If decoding fails, return original filename
  }

  return filename;
}

// Configure multer for file uploads using shared config
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: FILE_CONFIG.limits.maxFileSize,
    fieldSize: 1024 * 1024, // 1MB field limit
  },
  fileFilter: (_req, file, cb) => {
    // Fix UTF-8 encoding for Chinese filenames
    file.originalname = fixFilenameEncoding(file.originalname);

    const allowedTypes = getAllSupportedExtensions();
    const ext = getFileExtension(file.originalname);

    // Handle files without extension
    if (!ext) {
      cb(new Error('File must have an extension'));
      return;
    }

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${ext}. Supported types: ${allowedTypes.join(', ')}`));
    }
  },
});

export class RagController {
  private multimodalService: MultimodalFactoryService;

  constructor(
    private vectorDbService: VectorDbService,
    private embeddingService: IEmbeddingService,
    private documentIngestionService: DocumentIngestionService,
    private ragRetrievalService: RagRetrievalService,
    private configService: ConfigService,
    private logger: Logger
  ) {
    this.multimodalService = new MultimodalFactoryService(configService, logger);
  }

  private async getDefaultKnowledgeSourceId(): Promise<number> {
    const sources = await this.vectorDbService.getKnowledgeSources();
    const defaultSource = sources.find((s) => s.name === 'Default Knowledge Base');

    if (!defaultSource) {
      // Create default knowledge base if it doesn't exist
      const newSourceId = await this.vectorDbService.createKnowledgeSource({
        name: 'Default Knowledge Base',
        description: 'Default knowledge base for general documents',
        sourceType: 'general',
      });
      return newSourceId;
    }

    return defaultSource.id!;
  }

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

      // Use default knowledge base if none specified
      const finalKnowledgeSourceId =
        knowledgeSourceId || (await this.getDefaultKnowledgeSourceId());

      const result = await this.documentIngestionService.ingestText(content, title, {
        knowledgeSourceId: finalKnowledgeSourceId,
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

      const { knowledgeSourceId, metadata, multimodal } = req.body;
      const filePath = req.file.path;
      // Ensure filename encoding is correct
      const originalFileName = fixFilenameEncoding(req.file.originalname);

      try {
        // Use default knowledge base if none specified
        const finalKnowledgeSourceId = knowledgeSourceId
          ? parseInt(knowledgeSourceId)
          : await this.getDefaultKnowledgeSourceId();

        // Check if this is a multimodal file (image, video, audio)
        const mediaType = this.multimodalService.getMediaType(originalFileName);
        const isMultimodal = multimodal === 'true' || ['image', 'video', 'audio'].includes(mediaType);

        let result;

        if (isMultimodal && mediaType !== 'document') {
          // Process as multimodal content
          this.logger.info(`Processing multimodal ${mediaType} file: ${originalFileName}`);
          
          const multimodalResult = await this.multimodalService.processMedia(filePath, originalFileName, {
            extractText: true,
            generateThumbnail: true,
            analyzeContent: true,
            transcribe: mediaType === 'audio' || mediaType === 'video',
            extractFrames: mediaType === 'video',
            frameCount: 5,
          });

          // Extract text content for RAG ingestion
          let contentForIngestion = multimodalResult.textContent || '';
          
          // Add metadata as searchable content
          if (multimodalResult.analysis) {
            const analysisText = JSON.stringify(multimodalResult.analysis).replace(/[{}",]/g, ' ');
            contentForIngestion += `\n\nFile Analysis: ${analysisText}`;
          }

          // Add media info as content
          const mediaInfo = await this.multimodalService.getMediaInfo(filePath, originalFileName);
          contentForIngestion += `\n\nMedia Type: ${mediaInfo.type}\nFile Size: ${mediaInfo.size}`;
          
          if (mediaInfo.info) {
            const infoText = JSON.stringify(mediaInfo.info).replace(/[{}",]/g, ' ');
            contentForIngestion += `\nMedia Info: ${infoText}`;
          }

          // If no text content was extracted, create minimal content
          if (!contentForIngestion.trim()) {
            contentForIngestion = `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} file: ${originalFileName}`;
          }

          // Ingest the extracted content
          result = await this.documentIngestionService.ingestText(
            contentForIngestion,
            originalFileName,
            {
              knowledgeSourceId: finalKnowledgeSourceId,
              metadata: {
                ...(metadata ? JSON.parse(metadata) : {}),
                originalFileName,
                mediaType,
                multimodal: true,
                thumbnailPath: multimodalResult.thumbnailPath,
                additionalFiles: multimodalResult.additionalFiles,
                processingTime: multimodalResult.processingTime,
                originalFileSize: req.file.size,
                analysis: multimodalResult.analysis,
              },
            }
          );

          res.json({
            success: true,
            documentId: result.documentId,
            chunksCreated: result.chunksCreated,
            totalTokens: result.totalTokens,
            processingTime: result.processingTime,
            mediaType,
            multimodal: true,
            textExtracted: !!multimodalResult.textContent,
            thumbnailGenerated: !!multimodalResult.thumbnailPath,
            additionalFiles: multimodalResult.additionalFiles?.length || 0,
          });
        } else {
          // Process as regular document
          result = await this.documentIngestionService.ingestFile(filePath, {
            knowledgeSourceId: finalKnowledgeSourceId,
            metadata: {
              ...(metadata ? JSON.parse(metadata) : {}),
              originalFileName,
            },
          });

          res.json({
            success: true,
            documentId: result.documentId,
            chunksCreated: result.chunksCreated,
            totalTokens: result.totalTokens,
            processingTime: result.processingTime,
            mediaType: 'document',
            multimodal: false,
          });
        }
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

  public async moveDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { knowledgeSourceId } = req.body;

      if (knowledgeSourceId === undefined) {
        res.status(400).json({ error: 'Knowledge source ID is required' });
        return;
      }

      await this.vectorDbService.moveDocumentToKnowledgeSource(parseInt(id), knowledgeSourceId);

      res.json({
        message: 'Document moved successfully',
        documentId: parseInt(id),
        knowledgeSourceId,
      });
    } catch (error) {
      this.logger.error('Failed to move document:', error);
      res.status(500).json({ error: 'Failed to move document' });
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
        similarityThreshold = 0.3,
        useHybridSearch = true,
        contextWindowSize = 2,
        useReranking = true,
        rerankTopK = 20,
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
        useReranking,
        rerankTopK,
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
      const { query, knowledgeSourceId, limit = 5 } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      // Generate query embedding
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query);

      // Use hybrid search for better keyword matching
      const results = await this.vectorDbService.hybridSearch(
        query,
        queryEmbedding.embedding,
        limit,
        0.5, // vectorWeight - balance between semantic and keyword
        0.5, // keywordWeight - increase for better Chinese text matching
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

  // Configuration endpoints
  public async getRagConfiguration(_req: Request, res: Response): Promise<void> {
    try {
      const embeddingInfo = this.embeddingService.getModelInfo();
      const rerankingInfo = await this.ragRetrievalService.getRetrievalStats();
      const openaiConfig = this.configService.getOpenAIConfig();
      const ragConfig = this.configService.getRagConfig();

      res.json({
        success: true,
        configuration: {
          embedding: {
            provider: embeddingInfo.provider,
            model: embeddingInfo.defaultModel,
            isLocal: embeddingInfo.isLocal || false,
            isConfigured: this.embeddingService.isConfigured(),
            requiresApiKey: embeddingInfo.requiresApiKey || false,
            dimensions: embeddingInfo.dimensions,
            // Configuration values (without actual values for security)
            environment: {
              OPENAI_API_KEY: openaiConfig.apiKey ? '••••••••' : undefined,
              EMBEDDING_MODEL: ragConfig.embeddingModel || undefined,
              EMBEDDING_ENDPOINT: ragConfig.embeddingEndpoint || undefined,
            },
          },
          reranking: {
            provider: rerankingInfo.reranking.provider,
            method: rerankingInfo.reranking.method,
            isLocal: rerankingInfo.reranking.isLocal,
            isConfigured: rerankingInfo.reranking.isConfigured,
            requiresApiKey: rerankingInfo.reranking.requiresApiKey || false,
            // Configuration values (without actual values for security)
            environment: {
              RERANK_ENDPOINT: ragConfig.rerankEndpoint || undefined,
              RERANK_API_KEY: ragConfig.rerankApiKey ? '••••••••' : undefined,
              RERANK_FORCE_LOCAL: ragConfig.rerankForceLocal || undefined,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to get RAG configuration:', error);
      res.status(500).json({ error: 'Failed to get RAG configuration' });
    }
  }

  public async updateRagConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const { embedding, reranking } = req.body;

      if (!embedding && !reranking) {
        res.status(400).json({ error: 'No configuration provided' });
        return;
      }

      // Update configuration using ConfigService for persistence
      const ragConfig: any = {};

      if (embedding) {
        if (embedding.EMBEDDING_MODEL !== undefined) {
          ragConfig.embeddingModel = embedding.EMBEDDING_MODEL;
        }
        if (embedding.EMBEDDING_ENDPOINT !== undefined) {
          ragConfig.embeddingEndpoint = embedding.EMBEDDING_ENDPOINT;
        }
      }

      if (reranking) {
        if (reranking.RERANK_ENDPOINT !== undefined) {
          ragConfig.rerankEndpoint = reranking.RERANK_ENDPOINT;
        }
        if (reranking.RERANK_API_KEY !== undefined) {
          ragConfig.rerankApiKey = reranking.RERANK_API_KEY;
        }
        if (reranking.RERANK_FORCE_LOCAL !== undefined) {
          ragConfig.rerankForceLocal = reranking.RERANK_FORCE_LOCAL;
        }
      }

      // Update RAG configuration persistently
      this.configService.updateRagConfig(ragConfig);

      // Handle OpenAI API key separately if provided
      if (embedding && embedding.OPENAI_API_KEY !== undefined) {
        const openaiConfig = this.configService.getOpenAIConfig();
        this.configService.updateOpenAIConfig(
          embedding.OPENAI_API_KEY || openaiConfig.apiKey,
          openaiConfig.baseUrl,
          openaiConfig.model
        );
      }

      res.json({
        success: true,
        message: 'RAG configuration updated successfully and persisted',
      });
    } catch (error) {
      this.logger.error('Failed to update RAG configuration:', error);
      res.status(500).json({ error: 'Failed to update RAG configuration' });
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

  // Multimodal endpoints
  public async getMediaInfo(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.query;

      if (!filename) {
        res.status(400).json({ error: 'Filename is required' });
        return;
      }

      const mediaType = this.multimodalService.getMediaType(filename as string);
      const isSupported = this.multimodalService.isSupported(filename as string);
      const supportedExtensions = this.multimodalService.getSupportedExtensions();

      res.json({
        success: true,
        mediaType,
        isSupported,
        supportedExtensions,
        multimodalCapabilities: {
          image: {
            ocr: true,
            thumbnails: true,
            analysis: true,
            formats: supportedExtensions.image,
          },
          video: {
            frameExtraction: true,
            thumbnails: true,
            audioExtraction: true,
            transcription: true,
            formats: supportedExtensions.video,
          },
          audio: {
            transcription: true,
            waveforms: true,
            analysis: true,
            formats: supportedExtensions.audio,
          },
          document: {
            textExtraction: true,
            chunking: true,
            embedding: true,
            formats: supportedExtensions.document,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to get media info:', error);
      res.status(500).json({ error: 'Failed to get media info' });
    }
  }

  public async validateMediaFile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const filePath = req.file.path;
      const originalFileName = fixFilenameEncoding(req.file.originalname);

      try {
        const validation = await this.multimodalService.validateMedia(filePath, originalFileName);
        const mediaInfo = await this.multimodalService.getMediaInfo(filePath, originalFileName);

        res.json({
          success: true,
          isValid: validation.isValid,
          error: validation.error,
          mediaInfo,
        });
      } finally {
        // Clean up uploaded file
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          this.logger.warn('Failed to clean up validation file:', cleanupError);
        }
      }
    } catch (error) {
      this.logger.error('Failed to validate media file:', error);
      res.status(500).json({ error: 'Failed to validate media file' });
    }
  }

  public validateMediaFile_upload = upload.single('file');
}
