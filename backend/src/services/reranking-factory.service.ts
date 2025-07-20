import { Logger } from 'winston';
import {
  IRerankingService,
  LocalRerankingService,
  RemoteRerankingService,
} from './reranking.service';

export class RerankingFactory {
  static createRerankingService(logger: Logger): IRerankingService {
    const rerankEndpoint = process.env.RERANK_ENDPOINT;
    const rerankApiKey = process.env.RERANK_API_KEY;
    const forceLocal = process.env.RERANK_FORCE_LOCAL === 'true';

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
