import * as fs from 'fs/promises';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { getAllSupportedExtensions, getFileExtension } from '../config/file-types';

export interface ParsedFile {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    wordCount?: number;
    createdDate?: string;
    modifiedDate?: string;
    fileType: string;
  };
  pages?: PageContent[];
}

export interface PageContent {
  pageNumber: number;
  content: string;
  wordCount: number;
}

export class FileParserService {
  async parseFile(filePath: string, originalFileName: string): Promise<ParsedFile> {
    const extension = getFileExtension(originalFileName);

    if (!extension) {
      throw new Error('File must have an extension');
    }

    switch (extension) {
      case '.pdf':
        return this.parsePDF(filePath, originalFileName);
      case '.docx':
        return this.parseDOCX(filePath, originalFileName);
      case '.doc':
        return this.parseDOC(filePath, originalFileName);
      case '.txt':
      case '.md':
      case '.json':
      case '.csv':
      case '.xml':
      case '.yaml':
      case '.yml':
      case '.ini':
      case '.conf':
      case '.toml':
      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
      case '.py':
      case '.java':
      case '.cpp':
      case '.c':
      case '.h':
      case '.hpp':
      case '.css':
      case '.scss':
      case '.sass':
      case '.less':
      case '.html':
      case '.htm':
      case '.php':
      case '.rb':
      case '.go':
      case '.rs':
      case '.swift':
      case '.kt':
      case '.scala':
      case '.pl':
      case '.r':
      case '.m':
      case '.tex':
      case '.vue':
      case '.sql':
      case '.sh':
      case '.bat':
      case '.ps1':
      case '.dockerfile':
      case '.makefile':
      case '.log':
      case '.gitignore':
      case '.env':
      case '.properties':
      case '.cfg':
        return this.parseTextFile(filePath, originalFileName);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  private async parsePDF(filePath: string, originalFileName: string): Promise<ParsedFile> {
    try {
      console.log('FileParserService.parsePDF - Input:', { filePath, originalFileName });
      console.log('FileParserService.parsePDF - Absolute path:', path.resolve(filePath));

      // Check if file exists before trying to read
      try {
        await fs.access(filePath);
        console.log('FileParserService.parsePDF - File exists');
      } catch (accessErr) {
        console.error('FileParserService.parsePDF - File not accessible:', accessErr);
        throw new Error(`Cannot access PDF file at: ${filePath}`);
      }

      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);

      // For now, create estimated pages from full text since pdf-parse doesn't provide page-by-page extraction
      const pages: PageContent[] = [];

      if (data.text && data.numpages > 0) {
        // Estimate page breaks based on content length
        const words = data.text.split(/\s+/);
        const wordsPerPage = Math.max(50, Math.floor(words.length / data.numpages));

        for (let i = 0; i < data.numpages; i++) {
          const startIndex = i * wordsPerPage;
          const endIndex = Math.min((i + 1) * wordsPerPage, words.length);
          const pageWords = words.slice(startIndex, endIndex);
          const pageContent = pageWords.join(' ');

          if (pageContent.trim()) {
            pages.push({
              pageNumber: i + 1,
              content: pageContent,
              wordCount: pageWords.length,
            });
          }
        }
      }

      return {
        content: data.text,
        metadata: {
          title: data.info?.Title || path.basename(originalFileName, '.pdf'),
          author: data.info?.Author,
          pageCount: data.numpages,
          wordCount: this.countWords(data.text),
          createdDate: data.info?.CreationDate,
          modifiedDate: data.info?.ModDate,
          fileType: 'pdf',
        },
        pages,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async parseDOCX(filePath: string, originalFileName: string): Promise<ParsedFile> {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });

      // For metadata extraction from existing DOCX files, we'd need additional libraries
      // For now, we'll use basic metadata from mammoth

      return {
        content: result.value,
        metadata: {
          title: path.basename(originalFileName, '.docx'),
          wordCount: this.countWords(result.value),
          fileType: 'docx',
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async parseDOC(filePath: string, originalFileName: string): Promise<ParsedFile> {
    try {
      // For .doc files, we'll try to use mammoth as well
      // Note: mammoth primarily supports .docx, but may work with some .doc files
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });

      return {
        content: result.value,
        metadata: {
          title: path.basename(originalFileName, '.doc'),
          wordCount: this.countWords(result.value),
          fileType: 'doc',
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to parse DOC: ${error instanceof Error ? error.message : 'Unknown error'}. DOC format has limited support - consider converting to DOCX.`
      );
    }
  }

  private async parseTextFile(filePath: string, originalFileName: string): Promise<ParsedFile> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(originalFileName).toLowerCase();

      return {
        content,
        metadata: {
          title: path.basename(originalFileName),
          wordCount: this.countWords(content),
          fileType: extension.slice(1) || 'text',
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private countWords(text: string): number {
    const trimmedText = text.trim();
    if (!trimmedText) return 0;

    // Count Chinese characters as individual words
    const chineseCharCount = (trimmedText.match(/[\u4e00-\u9fff]/g) || []).length;

    // Count non-Chinese words (space-separated)
    const nonChineseText = trimmedText.replace(/[\u4e00-\u9fff]/g, '');
    const nonChineseWords = nonChineseText.split(/\s+/).filter((word) => word.length > 0).length;

    return chineseCharCount + nonChineseWords;
  }

  async validateFile(
    filePath: string,
    originalFileName: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const stats = await fs.stat(filePath);

      // Import shared config
      const { FILE_CONFIG } = await import('../config/file-types');

      // Check file size using shared config
      if (stats.size > FILE_CONFIG.limits.maxFileSize) {
        return {
          isValid: false,
          error: `File size exceeds ${FILE_CONFIG.limits.maxFileSizeDisplay} limit`,
        };
      }

      // Check if file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);

      // Validate file extension using shared config
      const extension = getFileExtension(originalFileName);
      const supportedExtensions = getAllSupportedExtensions();

      // Handle files without extension
      if (!extension) {
        return {
          isValid: false,
          error: 'File must have an extension',
        };
      }

      if (!supportedExtensions.includes(extension)) {
        return {
          isValid: false,
          error: `Unsupported file type: ${extension}`,
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const fileParserService = new FileParserService();
