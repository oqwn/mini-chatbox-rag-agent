import { BaseTool, ToolDefinition } from './base.tool';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';
import Tesseract, { RecognizeResult } from 'tesseract.js';
import sharp from 'sharp';

export class OCRTool extends BaseTool {
  constructor(private logger: Logger, private allowedPaths: string[]) {
    super();
  }

  get definition(): ToolDefinition {
    return {
      name: 'ocr_extract_text',
      description: 'Extract text from images using OCR (Optical Character Recognition)',
      parameters: [
        {
          name: 'image_path',
          type: 'string',
          description: 'Path to the image file to extract text from',
          required: true,
        },
        {
          name: 'language',
          type: 'string',
          description: 'Language code for OCR (e.g., "eng" for English, "chi_sim" for Simplified Chinese)',
          enum: ['eng', 'chi_sim', 'chi_tra', 'jpn', 'kor', 'fra', 'deu', 'spa'],
        },
        {
          name: 'preprocess',
          type: 'boolean',
          description: 'Whether to preprocess the image for better OCR results',
        },
        {
          name: 'output_format',
          type: 'string',
          description: 'Output format for the extracted text',
          enum: ['text', 'json', 'tsv'],
        },
      ],
    };
  }

  private isPathAllowed(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    return this.allowedPaths.some(allowed => 
      absolutePath.startsWith(path.resolve(allowed))
    );
  }

  private async preprocessImage(imagePath: string): Promise<string> {
    const outputPath = path.join(
      path.dirname(imagePath),
      `preprocessed_${path.basename(imagePath)}`
    );

    try {
      await sharp(imagePath)
        .grayscale() // Convert to grayscale
        .normalize() // Normalize contrast
        .sharpen() // Sharpen text
        .resize({ width: 2000 }) // Resize if too large
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      this.logger.warn('Image preprocessing failed, using original:', error);
      return imagePath;
    }
  }

  async execute(parameters: { 
    image_path: string; 
    language?: string;
    preprocess?: boolean;
    output_format?: string;
  }): Promise<any> {
    const { 
      image_path, 
      language = 'eng', 
      preprocess = true,
      output_format = 'text'
    } = parameters;

    if (!this.isPathAllowed(image_path)) {
      throw new Error(`Access denied: Path ${image_path} is not in allowed directories`);
    }

    try {
      // Check if file exists
      await fs.access(image_path);

      // Preprocess image if requested
      const processedPath = preprocess 
        ? await this.preprocessImage(image_path)
        : image_path;

      this.logger.info(`Starting OCR for: ${image_path} (language: ${language})`);

      // Perform OCR
      const result = await Tesseract.recognize(
        processedPath,
        language,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              this.logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        }
      ) as RecognizeResult;

      // Clean up preprocessed image if created
      if (preprocess && processedPath !== image_path) {
        try {
          await fs.unlink(processedPath);
        } catch (error) {
          this.logger.warn('Failed to clean up preprocessed image:', error);
        }
      }

      let output: any;
      const data = result.data as any; // Type assertion for flexibility
      switch (output_format) {
        case 'json':
          output = {
            text: data.text,
            confidence: data.confidence,
            words: data.words?.map((word: any) => ({
              text: word.text,
              confidence: word.confidence,
              bbox: word.bbox,
            })) || [],
            lines: data.lines?.map((line: any) => ({
              text: line.text,
              confidence: line.confidence,
              bbox: line.bbox,
            })) || [],
          };
          break;
        case 'tsv':
          output = data.tsv;
          break;
        default:
          output = data.text;
      }

      this.logger.info(`OCR completed for: ${image_path}`);

      return {
        success: true,
        image_path,
        language,
        confidence: result.data.confidence,
        text_length: result.data.text.length,
        word_count: data.words?.length || 0,
        output,
      };
    } catch (error) {
      this.logger.error(`OCR failed for ${image_path}:`, error);
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}