import * as fs from 'fs/promises';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

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
}

export class FileParserService {
  async parseFile(filePath: string, originalFileName: string): Promise<ParsedFile> {
    const extension = path.extname(originalFileName).toLowerCase();

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
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);

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
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  async validateFile(
    filePath: string,
    originalFileName: string
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      const stats = await fs.stat(filePath);

      // Check file size (10MB limit)
      if (stats.size > 10 * 1024 * 1024) {
        return {
          isValid: false,
          error: 'File size exceeds 10MB limit',
        };
      }

      // Check if file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);

      // Validate file extension
      const extension = path.extname(originalFileName).toLowerCase();
      const supportedExtensions = [
        '.pdf',
        '.docx',
        '.doc',
        '.txt',
        '.md',
        '.rtf',
        '.json',
        '.csv',
        '.tsv',
        '.xml',
        '.yaml',
        '.yml',
        '.ini',
        '.conf',
        '.toml',
        '.js',
        '.ts',
        '.jsx',
        '.tsx',
        '.py',
        '.java',
        '.cpp',
        '.c',
        '.h',
        '.hpp',
        '.css',
        '.scss',
        '.sass',
        '.less',
        '.html',
        '.htm',
        '.php',
        '.rb',
        '.go',
        '.rs',
        '.swift',
        '.kt',
        '.scala',
        '.pl',
        '.r',
        '.m',
        '.tex',
        '.vue',
        '.sql',
        '.sh',
        '.bat',
        '.ps1',
        '.dockerfile',
        '.makefile',
        '.log',
        '.gitignore',
        '.env',
        '.properties',
        '.cfg',
      ];

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
