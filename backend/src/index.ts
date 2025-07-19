import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import winston from 'winston';
import { ConfigService } from '@/services/config.service';
import { OpenAIService } from '@/services/openai.service';
import { PromptService } from '@/services/prompt.service';
import { VectorDbService } from '@/services/vector-db.service';
import { EmbeddingService } from '@/services/embedding.service';
import { DocumentIngestionService } from '@/services/document-ingestion.service';
import { RagRetrievalService } from '@/services/rag-retrieval.service';
import { ChatController } from '@/controllers/chat.controller';
import { SettingsController } from '@/controllers/settings.controller';
import { MCPController } from '@/controllers/mcp.controller';
import { RagController } from '@/controllers/rag.controller';
import { MCPService } from '@/services/mcp.service';
import { createChatRoutes } from '@/routes/chat.routes';
import { createSettingsRoutes } from '@/routes/settings.routes';
import { createMCPRoutes } from '@/routes/mcp.routes';
import { createRagRoutes } from '@/routes/rag.routes';

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Initialize services
const configService = new ConfigService();
const openAIService = new OpenAIService(configService, logger);
const promptService = new PromptService(logger);
const mcpService = new MCPService();

// Initialize RAG services
const vectorDbService = new VectorDbService(logger);
const embeddingService = new EmbeddingService(logger);
const documentIngestionService = new DocumentIngestionService(vectorDbService, embeddingService, logger);
const ragRetrievalService = new RagRetrievalService(vectorDbService, embeddingService, logger);

// Initialize controllers
const chatController = new ChatController(openAIService, mcpService, promptService, logger);
const settingsController = new SettingsController(configService, openAIService, logger);
const mcpController = new MCPController(mcpService);
const ragController = new RagController(vectorDbService, embeddingService, documentIngestionService, ragRetrievalService, logger);

// Create Express app
const app = express();

// Middleware
app.use(helmet());
// Disable compression for SSE endpoints
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === '/api/chat/stream') {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
// Parse CORS origins
const corsOrigins = configService
  .get('CORS_ORIGIN')
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api', createChatRoutes(chatController));
app.use('/api', createSettingsRoutes(settingsController));
app.use('/api', createMCPRoutes(mcpController));
app.use('/api/rag', createRagRoutes(ragController));

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = configService.get('PORT');
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`AI service configured: ${openAIService.isConfigured()}`);
});
