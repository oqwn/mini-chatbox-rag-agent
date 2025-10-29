import { Logger } from 'winston';
import { ImageProcessingService } from './image-processing.service';
import { VideoProcessingService } from './video-processing.service';
import { AudioProcessingService } from './audio-processing.service';
import { ConfigService } from './config.service';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MultimodalProcessingOptions {
  extractText?: boolean;
  generateThumbnail?: boolean;
  analyzeContent?: boolean;
  transcribe?: boolean;
  extractFrames?: boolean;
  frameCount?: number;
  language?: string;
}

export interface MultimodalResult {
  type: MediaType;
  metadata: any;
  textContent?: string;
  thumbnailPath?: string;
  additionalFiles?: string[];
  analysis?: any;
  processingTime: number;
}

export class MultimodalFactoryService {
  private imageService: ImageProcessingService;
  private videoService: VideoProcessingService;
  private audioService: AudioProcessingService;

  constructor(
    _configService: ConfigService,
    private logger: Logger
  ) {
    this.imageService = new ImageProcessingService(logger);
    this.videoService = new VideoProcessingService(logger);
    this.audioService = new AudioProcessingService(logger);
  }

  /**
   * Determine media type from file extension
   */
  getMediaType(filename: string): MediaType {
    const extension = this.getFileExtension(filename).toLowerCase();

    // Image formats
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'].includes(extension)) {
      return 'image';
    }

    // Video formats
    if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'].includes(extension)) {
      return 'video';
    }

    // Audio formats
    if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'].includes(extension)) {
      return 'audio';
    }

    // Default to document for everything else
    return 'document';
  }

  /**
   * Process any media file based on its type
   */
  async processMedia(
    filePath: string,
    filename: string,
    options: MultimodalProcessingOptions = {}
  ): Promise<MultimodalResult> {
    const startTime = Date.now();
    const mediaType = this.getMediaType(filename);

    this.logger.info(`Processing ${mediaType} file: ${filename}`);

    try {
      let result: MultimodalResult;

      switch (mediaType) {
        case 'image':
          result = await this.processImage(filePath, options);
          break;
        case 'video':
          result = await this.processVideo(filePath, options);
          break;
        case 'audio':
          result = await this.processAudio(filePath, options);
          break;
        case 'document':
        default:
          // For documents, use existing file parser service
          result = await this.processDocument(filePath, filename);
          break;
      }

      result.type = mediaType;
      result.processingTime = Date.now() - startTime;

      this.logger.info(
        `Completed processing ${mediaType} file: ${filename} in ${result.processingTime}ms`
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to process ${mediaType} file ${filename}:`, error);
      throw new Error(
        `${mediaType} processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process image file
   */
  private async processImage(
    filePath: string,
    options: MultimodalProcessingOptions
  ): Promise<MultimodalResult> {
    const imageResult = await this.imageService.processImage(filePath, {
      extractText: options.extractText,
      generateThumbnail: options.generateThumbnail,
      analyzeContent: options.analyzeContent,
    });

    const additionalFiles: string[] = [];
    if (imageResult.thumbnailPath) {
      additionalFiles.push(imageResult.thumbnailPath);
    }

    return {
      type: 'image',
      metadata: imageResult.metadata,
      textContent: imageResult.ocrText,
      thumbnailPath: imageResult.thumbnailPath,
      additionalFiles,
      analysis: imageResult.features,
      processingTime: 0, // Will be set by caller
    };
  }

  /**
   * Process video file
   */
  private async processVideo(
    filePath: string,
    options: MultimodalProcessingOptions
  ): Promise<MultimodalResult> {
    const videoResult = await this.videoService.processVideo(filePath, {
      extractFrames: options.extractFrames,
      frameCount: options.frameCount || 5,
      generateThumbnail: options.generateThumbnail,
      extractAudio: options.transcribe,
    });

    const additionalFiles: string[] = [];
    if (videoResult.thumbnailPath) {
      additionalFiles.push(videoResult.thumbnailPath);
    }
    if (videoResult.frames) {
      additionalFiles.push(...videoResult.frames.map((f) => f.filePath));
    }
    if (videoResult.audioPath) {
      additionalFiles.push(videoResult.audioPath);
    }

    // If we extracted audio and transcription is requested, transcribe it
    let textContent = '';
    if (options.transcribe && videoResult.audioPath) {
      try {
        const audioResult = await this.audioService.transcribeAudio(videoResult.audioPath, {
          language: options.language,
        });
        textContent = audioResult.text;
      } catch (error) {
        this.logger.warn(`Failed to transcribe video audio: ${error}`);
      }
    }

    return {
      type: 'video',
      metadata: videoResult.metadata,
      textContent,
      thumbnailPath: videoResult.thumbnailPath,
      additionalFiles,
      analysis: videoResult.summary,
      processingTime: 0, // Will be set by caller
    };
  }

  /**
   * Process audio file
   */
  private async processAudio(
    filePath: string,
    options: MultimodalProcessingOptions
  ): Promise<MultimodalResult> {
    const audioResult = await this.audioService.processAudio(filePath, {
      transcribe: options.transcribe,
      analyze: options.analyzeContent,
      language: options.language,
      generateWaveform: options.generateThumbnail,
    });

    const additionalFiles: string[] = [];
    if (audioResult.convertedPath) {
      additionalFiles.push(audioResult.convertedPath);
    }
    if (audioResult.waveformPath) {
      additionalFiles.push(audioResult.waveformPath);
    }

    return {
      type: 'audio',
      metadata: audioResult.metadata,
      textContent: audioResult.transcription?.text,
      thumbnailPath: audioResult.waveformPath, // Use waveform as thumbnail
      additionalFiles,
      analysis: audioResult.analysis,
      processingTime: 0, // Will be set by caller
    };
  }

  /**
   * Process document file (fallback to existing parser)
   */
  private async processDocument(filePath: string, filename: string): Promise<MultimodalResult> {
    // Import the existing file parser service
    const { fileParserService } = await import('./file-parser.service');

    const parseResult = await fileParserService.parseFile(filePath, filename);

    return {
      type: 'document',
      metadata: parseResult.metadata,
      textContent: parseResult.content,
      analysis: {
        pageCount: parseResult.metadata.pageCount,
        wordCount: parseResult.metadata.wordCount,
        hasPages: !!parseResult.pages,
      },
      processingTime: 0, // Will be set by caller
    };
  }

  /**
   * Validate media file
   */
  async validateMedia(
    filePath: string,
    filename: string
  ): Promise<{ isValid: boolean; error?: string }> {
    const mediaType = this.getMediaType(filename);

    try {
      switch (mediaType) {
        case 'image':
          return await this.imageService.validateImage(filePath);
        case 'video':
          return await this.videoService.validateVideo(filePath);
        case 'audio':
          return await this.audioService.validateAudio(filePath);
        case 'document':
        default:
          // Use existing file parser validation
          const { fileParserService } = await import('./file-parser.service');
          return await fileParserService.validateFile(filePath, filename);
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get supported media extensions
   */
  getSupportedExtensions(): { [key in MediaType]: string[] } {
    return {
      image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'],
      video: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'],
      audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'],
      document: [
        '.pdf',
        '.docx',
        '.doc',
        '.txt',
        '.md',
        '.rtf',
        '.json',
        '.csv',
        '.xml',
        '.yaml',
        '.yml',
        '.js',
        '.ts',
        '.py',
        '.java',
        '.cpp',
        '.c',
        '.html',
        '.css',
        '.sql',
        '.log',
      ],
    };
  }

  /**
   * Check if file type is supported
   */
  isSupported(filename: string): boolean {
    const extension = this.getFileExtension(filename).toLowerCase();
    const supportedExtensions = this.getSupportedExtensions();

    return Object.values(supportedExtensions).some((extensions) => extensions.includes(extension));
  }

  /**
   * Get media info without full processing
   */
  async getMediaInfo(
    filePath: string,
    filename: string
  ): Promise<{
    type: MediaType;
    size: string;
    info: any;
  }> {
    const mediaType = this.getMediaType(filename);
    const fs = require('fs');
    const stats = fs.statSync(filePath);

    let info: any = {};

    try {
      switch (mediaType) {
        case 'image':
          const imageMetadata = await this.imageService.getImageMetadata(filePath);
          info = {
            dimensions: `${imageMetadata.width}x${imageMetadata.height}`,
            format: imageMetadata.format,
          };
          break;
        case 'video':
          const videoInfo = await this.videoService.getVideoInfo(filePath);
          info = videoInfo;
          break;
        case 'audio':
          const audioInfo = await this.audioService.getAudioInfo(filePath);
          info = audioInfo;
          break;
        case 'document':
        default:
          info = {
            extension: this.getFileExtension(filename),
          };
          break;
      }
    } catch (error) {
      this.logger.warn(`Failed to get ${mediaType} info: ${error}`);
    }

    return {
      type: mediaType,
      size: this.formatFileSize(stats.size),
      info,
    };
  }

  /**
   * Extract file extension
   */
  private getFileExtension(filename: string): string {
    return '.' + filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Format file size in human readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}
