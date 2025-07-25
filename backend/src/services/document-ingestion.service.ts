import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from 'winston';
import { VectorDbService, Document, DocumentChunk } from './vector-db.service';
import { IEmbeddingService } from './embedding-factory.service';
import { fileParserService, ParsedFile, PageContent } from './file-parser.service';

export interface IngestionResult {
  documentId: number;
  chunksCreated: number;
  totalTokens: number;
  processingTime: number;
}

export interface ChunkingOptions {
  chunkSize: number; // Maximum tokens per chunk
  chunkOverlap: number; // Overlap between chunks in tokens
  separators: string[]; // Text separators to prefer for splitting
}

export interface IngestionOptions {
  chunkingOptions?: ChunkingOptions;
  knowledgeSourceId?: number;
  metadata?: Record<string, any>;
  generateEmbeddings?: boolean;
}

export class DocumentIngestionService {
  private defaultChunkingOptions: ChunkingOptions = {
    chunkSize: 800, // Increased for better performance, tokens
    chunkOverlap: 80, // tokens
    // Added Chinese punctuation marks for better text chunking
    separators: [
      '\n\n',
      '\n',
      '。',
      '！',
      '？',
      '；',
      '：',
      '. ',
      '! ',
      '? ',
      '; ',
      ': ',
      '，',
      ', ',
      ' ',
    ],
  };

  constructor(
    private vectorDbService: VectorDbService,
    private embeddingService: IEmbeddingService,
    private logger: Logger
  ) {}

  /**
   * Ingest a single document from file
   */
  async ingestFile(filePath: string, options: IngestionOptions = {}): Promise<IngestionResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting ingestion of file: ${filePath}`);

      // Extract file metadata - use original filename if provided
      const fileName = options.metadata?.originalFileName || path.basename(filePath);
      const fileStats = await fs.stat(filePath);

      // Validate file before processing using original filename
      const validation = await fileParserService.validateFile(filePath, fileName);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Parse file content using the file parser service with original filename
      const parsedFile: ParsedFile = await fileParserService.parseFile(filePath, fileName);

      const document: Document = {
        title: options.metadata?.title || parsedFile.metadata.title || fileName,
        content: parsedFile.content,
        filePath,
        fileType: parsedFile.metadata.fileType,
        fileSize: fileStats.size,
        knowledgeSourceId: options.knowledgeSourceId,
        metadata: {
          ...options.metadata,
          ...parsedFile.metadata,
          originalFileName: fileName,
          ingestedAt: new Date().toISOString(),
        },
      };

      // Create document record
      const documentId = await this.vectorDbService.createDocument(document);

      // Process chunks
      const result = await this.processDocumentChunks(
        documentId,
        parsedFile.content,
        options,
        parsedFile
      );

      const processingTime = Date.now() - startTime;

      this.logger.info(
        `Completed ingestion of ${fileName}: ${result.chunksCreated} chunks, ${result.totalTokens} tokens, ${processingTime}ms`
      );

      return {
        documentId,
        chunksCreated: result.chunksCreated,
        totalTokens: result.totalTokens,
        processingTime,
      };
    } catch (error) {
      this.logger.error(`Failed to ingest file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Ingest text content directly
   */
  async ingestText(
    content: string,
    title: string,
    options: IngestionOptions = {}
  ): Promise<IngestionResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting ingestion of text: ${title}`);

      const document: Document = {
        title,
        content,
        fileType: 'text',
        knowledgeSourceId: options.knowledgeSourceId,
        metadata: {
          ...options.metadata,
          ingestedAt: new Date().toISOString(),
          source: 'direct_text',
        },
      };

      // Create document record
      const documentId = await this.vectorDbService.createDocument(document);

      // Process chunks
      const result = await this.processDocumentChunks(documentId, content, options);

      const processingTime = Date.now() - startTime;

      this.logger.info(
        `Completed text ingestion: ${result.chunksCreated} chunks, ${result.totalTokens} tokens, ${processingTime}ms`
      );

      return {
        documentId,
        chunksCreated: result.chunksCreated,
        totalTokens: result.totalTokens,
        processingTime,
      };
    } catch (error) {
      this.logger.error(`Failed to ingest text content:`, error);
      throw error;
    }
  }

  /**
   * Ingest multiple files from a directory
   */
  async ingestDirectory(
    directoryPath: string,
    options: IngestionOptions = {}
  ): Promise<IngestionResult[]> {
    try {
      this.logger.info(`Starting directory ingestion: ${directoryPath}`);

      const files = await this.getTextFiles(directoryPath);
      const results: IngestionResult[] = [];

      for (const filePath of files) {
        try {
          const result = await this.ingestFile(filePath, options);
          results.push(result);
        } catch (error) {
          this.logger.error(`Failed to ingest ${filePath}:`, error);
          // Continue with other files
        }
      }

      this.logger.info(
        `Completed directory ingestion: ${results.length}/${files.length} files processed`
      );

      return results;
    } catch (error) {
      this.logger.error(`Failed to ingest directory ${directoryPath}:`, error);
      throw error;
    }
  }

  /**
   * Process document into chunks and optionally generate embeddings
   */
  private async processDocumentChunks(
    documentId: number,
    content: string,
    options: IngestionOptions,
    parsedFile?: ParsedFile
  ): Promise<{ chunksCreated: number; totalTokens: number }> {
    const chunkingOptions = { ...this.defaultChunkingOptions, ...options.chunkingOptions };

    // Split content into chunks
    const textChunks = this.chunkText(content, chunkingOptions);

    this.logger.debug(`Split document into ${textChunks.length} chunks`);

    // Create chunk records with page information
    const chunks: DocumentChunk[] = [];
    let totalTokens = 0;

    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i];
      const tokenCount = this.estimateTokenCount(chunkText);
      totalTokens += tokenCount;

      // Find which page(s) this chunk belongs to
      const pageInfo = this.findChunkPageInfo(chunkText, parsedFile?.pages);

      const chunk: DocumentChunk = {
        documentId,
        chunkText,
        chunkIndex: i,
        tokenCount,
        metadata: {
          chunkSize: chunkText.length,
          estimatedTokens: tokenCount,
          pageNumber: pageInfo.pageNumber,
          pageNumbers: pageInfo.pageNumbers,
          startPage: pageInfo.startPage,
          endPage: pageInfo.endPage,
          exactPreview: chunkText.length > 300 ? chunkText.substring(0, 300) + '...' : chunkText,
        },
      };

      chunks.push(chunk);
    }

    // Insert chunks into database using batch operation for better performance
    const chunkIds: number[] = await this.vectorDbService.createDocumentChunksBatch(chunks);

    // Generate embeddings if requested
    if (options.generateEmbeddings !== false) {
      await this.generateEmbeddings(chunkIds, textChunks);
    }

    return {
      chunksCreated: chunks.length,
      totalTokens,
    };
  }

  /**
   * Find which page(s) a chunk belongs to by matching content
   */
  private findChunkPageInfo(
    chunkText: string,
    pages?: PageContent[]
  ): {
    pageNumber: number | null;
    pageNumbers: number[];
    startPage: number | null;
    endPage: number | null;
  } {
    if (!pages || pages.length === 0) {
      return {
        pageNumber: null,
        pageNumbers: [],
        startPage: null,
        endPage: null,
      };
    }

    const matchingPages: number[] = [];
    const chunkWords = chunkText.toLowerCase().split(/\s+/).slice(0, 20); // Use first 20 words for matching

    for (const page of pages) {
      // Check if chunk content appears in this page
      const chunkStart = chunkWords.slice(0, 10).join(' ');
      if (page.content.toLowerCase().includes(chunkStart)) {
        matchingPages.push(page.pageNumber);
      }
    }

    // If no exact match found, estimate based on chunk position
    if (matchingPages.length === 0) {
      // Estimate page based on chunk index and total pages
      const totalPages = pages.length;
      const estimatedPage = Math.min(
        totalPages,
        Math.max(1, Math.ceil((pages.length / 10) * (Math.random() * 10)))
      );
      matchingPages.push(estimatedPage);
    }

    return {
      pageNumber: matchingPages[0] || null,
      pageNumbers: matchingPages,
      startPage: matchingPages.length > 0 ? Math.min(...matchingPages) : null,
      endPage: matchingPages.length > 0 ? Math.max(...matchingPages) : null,
    };
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(chunkIds: number[], textChunks: string[]): Promise<void> {
    try {
      this.logger.debug(`Generating embeddings for ${textChunks.length} chunks`);

      const batchResponse = await this.embeddingService.generateBatchEmbeddings({
        texts: textChunks,
      });

      // Update chunks with embeddings in batches for better performance
      await this.vectorDbService.updateChunkEmbeddingsBatch(chunkIds, batchResponse.embeddings);

      this.logger.debug(`Updated ${chunkIds.length} chunks with embeddings`);
    } catch (error) {
      this.logger.error('Failed to generate embeddings for chunks:', error);
      // Don't throw - chunks are still created, just without embeddings
    }
  }

  /**
   * Chunk text into smaller pieces
   */
  private chunkText(text: string, options: ChunkingOptions): string[] {
    const chunks: string[] = [];
    const lines = text.split('\n');
    let currentChunk = '';
    let currentTokenCount = 0;

    for (const line of lines) {
      const lineTokenCount = this.estimateTokenCount(line);

      // If adding this line would exceed chunk size, finalize current chunk
      if (currentTokenCount + lineTokenCount > options.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        // Start new chunk with overlap
        currentChunk = this.getOverlapText(currentChunk, options.chunkOverlap);
        currentTokenCount = this.estimateTokenCount(currentChunk);
      }

      currentChunk += (currentChunk ? '\n' : '') + line;
      currentTokenCount += lineTokenCount;
    }

    // Add final chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Handle very long chunks by splitting on separators
    return this.splitLongChunks(chunks, options);
  }

  /**
   * Split chunks that are still too long
   */
  private splitLongChunks(chunks: string[], options: ChunkingOptions): string[] {
    const result: string[] = [];

    for (const chunk of chunks) {
      if (this.estimateTokenCount(chunk) <= options.chunkSize) {
        result.push(chunk);
        continue;
      }

      // Try to split on separators
      const subChunks = this.splitOnSeparators(chunk, options);
      result.push(...subChunks);
    }

    return result;
  }

  /**
   * Split text on separators
   */
  private splitOnSeparators(text: string, options: ChunkingOptions): string[] {
    const chunks: string[] = [];

    for (const separator of options.separators) {
      const parts = text.split(separator);
      let currentChunk = '';

      for (const part of parts) {
        const partWithSeparator = part + separator;
        const potentialChunk = currentChunk + partWithSeparator;

        if (this.estimateTokenCount(potentialChunk) <= options.chunkSize) {
          currentChunk = potentialChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = partWithSeparator;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      // If we successfully split, return the result
      if (chunks.length > 1) {
        return chunks;
      }

      // Reset for next separator
      chunks.length = 0;
    }

    // If no separator worked, split by character count
    return this.splitByCharacterCount(text, options.chunkSize);
  }

  /**
   * Split text by character count as last resort
   */
  private splitByCharacterCount(text: string, maxTokens: number): string[] {
    const maxChars = maxTokens * 4; // Rough approximation
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += maxChars) {
      chunks.push(text.slice(i, i + maxChars));
    }

    return chunks;
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapTokens: number): string {
    const overlapChars = overlapTokens * 4; // Rough approximation
    return text.slice(-overlapChars);
  }

  /**
   * Estimate token count (rough approximation)
   * Improved for international characters including Chinese
   */
  private estimateTokenCount(text: string): number {
    // More accurate estimation for mixed language content
    // Chinese characters: ~1 char = 1.5-2 tokens
    // English words: ~4 chars = 1 token
    const chineseCharCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherCharCount = text.length - chineseCharCount;

    const chineseTokens = Math.ceil(chineseCharCount * 1.8);
    const englishTokens = Math.ceil(otherCharCount / 4);

    return chineseTokens + englishTokens;
  }

  /**
   * Get all text files from directory recursively
   */
  private async getTextFiles(directoryPath: string): Promise<string[]> {
    const textExtensions = ['.txt', '.md', '.rst', '.json', '.csv', '.log'];
    const files: string[] = [];

    const processDirectory = async (dir: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (textExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    await processDirectory(directoryPath);
    return files;
  }
}
