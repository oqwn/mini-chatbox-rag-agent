import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import winston from 'winston';
import { ConfigService } from '@/services/config.service';
import { OpenAIService } from '@/services/openai.service';
import { ChatController } from '@/controllers/chat.controller';
import { SettingsController } from '@/controllers/settings.controller';
import { createChatRoutes } from '@/routes/chat.routes';
import { createSettingsRoutes } from '@/routes/settings.routes';

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

// Initialize controllers
const chatController = new ChatController(openAIService, logger);
const settingsController = new SettingsController(configService, openAIService, logger);

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(compression());
// Parse CORS origins
const corsOrigins = configService.get('CORS_ORIGIN').split(',').map(origin => origin.trim());

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
