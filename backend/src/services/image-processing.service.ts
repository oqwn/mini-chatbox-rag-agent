import sharp from 'sharp';
import tesseract from 'node-tesseract-ocr';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
  density?: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
}

export interface ImageProcessingResult {
  metadata: ImageMetadata;
  thumbnailPath?: string;
  ocrText?: string;
  description?: string;
  features?: {
    isDocument: boolean;
    hasText: boolean;
    dominantColors: string[];
    objects?: string[];
  };
}

export class ImageProcessingService {
  private tesseractConfig = {
    lang: 'eng+chi_sim+chi_tra', // English + Simplified Chinese + Traditional Chinese
    oem: 1,
    psm: 3,
  };

  constructor(private logger: Logger) {}

  /**
   * Process an image file and extract metadata, OCR text, and other features
   */
  async processImage(
    imagePath: string,
    options: {
      generateThumbnail?: boolean;
      extractText?: boolean;
      analyzeContent?: boolean;
      thumbnailSize?: number;
    } = {}
  ): Promise<ImageProcessingResult> {
    try {
      this.logger.info(`Processing image: ${imagePath}`);

      // Get image metadata
      const metadata = await this.getImageMetadata(imagePath);

      const result: ImageProcessingResult = { metadata };

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        result.thumbnailPath = await this.generateThumbnail(
          imagePath,
          options.thumbnailSize || 200
        );
      }

      // Extract text via OCR if requested
      if (options.extractText) {
        try {
          const ocrResult = await this.extractTextFromImage(imagePath);
          result.ocrText = ocrResult.text;
          
          // Analyze if this looks like a document
          if (!result.features) result.features = { 
            isDocument: false, 
            hasText: false, 
            dominantColors: [] 
          };
          result.features.hasText = ocrResult.text.trim().length > 0;
          result.features.isDocument = this.isDocumentImage(ocrResult);
        } catch (error) {
          this.logger.warn(`OCR failed for ${imagePath}:`, error);
        }
      }

      // Analyze image content if requested
      if (options.analyzeContent) {
        try {
          const analysis = await this.analyzeImageContent(imagePath);
          if (!result.features) result.features = { 
            isDocument: false, 
            hasText: false, 
            dominantColors: [] 
          };
          result.features.dominantColors = analysis.dominantColors;
        } catch (error) {
          this.logger.warn(`Content analysis failed for ${imagePath}:`, error);
        }
      }

      this.logger.info(`Image processing completed for: ${imagePath}`);
      return result;
    } catch (error) {
      this.logger.error(`Image processing failed for ${imagePath}:`, error);
      throw new Error(
        `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get detailed metadata from an image
   */
  async getImageMetadata(imagePath: string): Promise<ImageMetadata> {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const stats = await fs.stat(imagePath);

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: stats.size,
      hasAlpha: metadata.hasAlpha || false,
      density: metadata.density,
    };
  }

  /**
   * Generate a thumbnail for an image
   */
  async generateThumbnail(imagePath: string, size: number = 200): Promise<string> {
    const dir = path.dirname(imagePath);
    const name = path.basename(imagePath, path.extname(imagePath));
    const thumbnailPath = path.join(dir, `${name}_thumb_${size}.jpg`);

    await sharp(imagePath)
      .resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  }

  /**
   * Extract text from image using OCR
   */
  async extractTextFromImage(imagePath: string): Promise<OCRResult> {
    try {
      // Preprocess image for better OCR results
      const preprocessedPath = await this.preprocessImageForOCR(imagePath);

      // Perform OCR
      const text = await tesseract.recognize(preprocessedPath, this.tesseractConfig);

      // Clean up preprocessed image if it's different from original
      if (preprocessedPath !== imagePath) {
        try {
          await fs.unlink(preprocessedPath);
        } catch (error) {
          this.logger.warn(`Failed to cleanup preprocessed image: ${error}`);
        }
      }

      // For now, return basic OCR result
      // In production, you might want to use more advanced OCR with word-level confidence
      return {
        text: text.trim(),
        confidence: text.length > 0 ? 0.8 : 0, // Basic confidence estimation
        words: [], // Would need more advanced OCR library for word-level data
      };
    } catch (error) {
      this.logger.error(`OCR failed for ${imagePath}:`, error);
      return {
        text: '',
        confidence: 0,
        words: [],
      };
    }
  }

  /**
   * Preprocess image for better OCR results
   */
  private async preprocessImageForOCR(imagePath: string): Promise<string> {
    const dir = path.dirname(imagePath);
    const name = path.basename(imagePath, path.extname(imagePath));
    const preprocessedPath = path.join(dir, `${name}_ocr_preprocessed.png`);

    try {
      await sharp(imagePath)
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(preprocessedPath);

      return preprocessedPath;
    } catch (error) {
      this.logger.warn(`Image preprocessing failed, using original: ${error}`);
      return imagePath;
    }
  }

  /**
   * Analyze image content to extract features
   */
  async analyzeImageContent(imagePath: string): Promise<{
    dominantColors: string[];
    avgBrightness: number;
  }> {
    const image = sharp(imagePath);
    
    // Get dominant colors by analyzing pixels
    const { data, info } = await image
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colors = this.extractDominantColors(data, info.channels);
    const brightness = this.calculateAverageBrightness(data, info.channels);

    return {
      dominantColors: colors,
      avgBrightness: brightness,
    };
  }

  /**
   * Extract dominant colors from image data
   */
  private extractDominantColors(data: Buffer, channels: number): string[] {
    const colorCounts = new Map<string, number>();
    
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Group similar colors (reduce precision)
      const groupedR = Math.floor(r / 32) * 32;
      const groupedG = Math.floor(g / 32) * 32;
      const groupedB = Math.floor(b / 32) * 32;
      
      const color = `rgb(${groupedR},${groupedG},${groupedB})`;
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }

    // Get top 5 colors
    return Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color]) => color);
  }

  /**
   * Calculate average brightness of image
   */
  private calculateAverageBrightness(data: Buffer, channels: number): number {
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Calculate luminance
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += brightness;
      pixelCount++;
    }

    return totalBrightness / pixelCount / 255; // Normalize to 0-1
  }

  /**
   * Determine if image likely contains a document
   */
  private isDocumentImage(ocrResult: OCRResult): boolean {
    const text = ocrResult.text.toLowerCase();
    
    // Simple heuristics for document detection
    const hasSignificantText = text.length > 50;
    const hasDocumentKeywords = /\b(page|document|article|title|header|footer|paragraph)\b/.test(text);
    const hasStructuredText = text.includes('\n') && text.split('\n').length > 3;
    
    return hasSignificantText && (hasDocumentKeywords || hasStructuredText);
  }

  /**
   * Validate image file
   */
  async validateImage(filePath: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size (50MB limit)
      if (stats.size > 50 * 1024 * 1024) {
        return { isValid: false, error: 'Image file too large (max 50MB)' };
      }

      // Try to read image metadata to validate format
      const image = sharp(filePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        return { isValid: false, error: 'Invalid image format' };
      }

      // Check dimensions (max 10000x10000)
      if (metadata.width > 10000 || metadata.height > 10000) {
        return { isValid: false, error: 'Image dimensions too large (max 10000x10000)' };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Convert image to different format
   */
  async convertImage(
    inputPath: string,
    outputPath: string,
    format: 'jpeg' | 'png' | 'webp' = 'jpeg',
    quality: number = 80
  ): Promise<void> {
    let pipeline = sharp(inputPath);

    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality });
        break;
      case 'png':
        pipeline = pipeline.png();
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
    }

    await pipeline.toFile(outputPath);
  }
}