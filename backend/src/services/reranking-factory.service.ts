import { Logger } from 'winston';
import { ConfigService } from './config.service';
import {
  IRerankingService,
  LocalRerankingService,
  RemoteRerankingService,
} from './reranking.service';

export class RerankingFactory {
  static createRerankingService(configService: ConfigService, logger: Logger): IRerankingService {
    const ragConfig = configService.getRagConfig();
    const rerankEndpoint = ragConfig.rerankEndpoint;
    const rerankApiKey = ragConfig.rerankApiKey;
    const forceLocal = ragConfig.rerankForceLocal === 'true';

    // If forced to use local or no endpoint configured, use local service
    if (forceLocal || !rerankEndpoint) {
      logger.info('Using local reranking service');
      return new LocalRerankingService(logger);
    }

    // Try remote service first, with fallback to local
    logger.info(`Using remote reranking service: ${rerankEndpoint}`);
    return new RemoteRerankingService(logger, rerankEndpoint, rerankApiKey);
  }
}
