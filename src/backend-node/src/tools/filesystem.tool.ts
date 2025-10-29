import { BaseTool, ToolDefinition } from './base.tool';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from 'winston';

export class ReadFileTool extends BaseTool {
  constructor(
    private logger: Logger,
    private allowedPaths: string[]
  ) {
    super();
  }

  get definition(): ToolDefinition {
    return {
      name: 'read_file',
      description: 'Read the contents of a file from the file system',
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          description: 'The path to the file to read',
          required: true,
        },
        {
          name: 'encoding',
          type: 'string',
          description: 'The encoding to use when reading the file',
          enum: ['utf8', 'base64', 'hex'],
        },
      ],
    };
  }

  private isPathAllowed(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    const result = this.allowedPaths.some((allowed) =>
      absolutePath.startsWith(path.resolve(allowed))
    );

    if (!result) {
      this.logger.warn(
        `Path not allowed: ${absolutePath}. Allowed paths: ${this.allowedPaths.map((p) => path.resolve(p)).join(', ')}`
      );
    }

    return result;
  }

  async execute(parameters: { file_path: string; encoding?: string }): Promise<any> {
    const { file_path, encoding = 'utf8' } = parameters;

    if (!this.isPathAllowed(file_path)) {
      throw new Error(
        `Access denied: Path ${file_path} is not in allowed directories. Allowed directories: ${this.allowedPaths.join(', ')}`
      );
    }

    try {
      const content = await fs.readFile(file_path, encoding as BufferEncoding);
      this.logger.info(`Successfully read file: ${file_path}`);
      return {
        success: true,
        content,
        path: file_path,
        size: (await fs.stat(file_path)).size,
      };
    } catch (error) {
      this.logger.error(`Failed to read file ${file_path}:`, error);
      throw new Error(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export class WriteFileTool extends BaseTool {
  constructor(
    private logger: Logger,
    private allowedPaths: string[]
  ) {
    super();
  }

  get definition(): ToolDefinition {
    return {
      name: 'write_file',
      description: 'Write content to a file on the file system',
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          description: 'The path where the file should be written',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'The content to write to the file',
          required: true,
        },
        {
          name: 'encoding',
          type: 'string',
          description: 'The encoding to use when writing the file',
          enum: ['utf8', 'base64', 'hex'],
        },
        {
          name: 'create_directories',
          type: 'boolean',
          description: "Whether to create parent directories if they don't exist",
        },
      ],
    };
  }

  private isPathAllowed(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    const result = this.allowedPaths.some((allowed) =>
      absolutePath.startsWith(path.resolve(allowed))
    );

    if (!result) {
      this.logger.warn(
        `Path not allowed: ${absolutePath}. Allowed paths: ${this.allowedPaths.map((p) => path.resolve(p)).join(', ')}`
      );
    }

    return result;
  }

  async execute(parameters: {
    file_path: string;
    content: string;
    encoding?: string;
    create_directories?: boolean;
  }): Promise<any> {
    const { file_path, content, encoding = 'utf8', create_directories = false } = parameters;

    if (!this.isPathAllowed(file_path)) {
      throw new Error(
        `Access denied: Path ${file_path} is not in allowed directories. Allowed directories: ${this.allowedPaths.join(', ')}`
      );
    }

    try {
      if (create_directories) {
        await fs.mkdir(path.dirname(file_path), { recursive: true });
      }

      await fs.writeFile(file_path, content, encoding as BufferEncoding);
      this.logger.info(`Successfully wrote file: ${file_path}`);

      return {
        success: true,
        path: file_path,
        size: Buffer.byteLength(content, encoding as BufferEncoding),
      };
    } catch (error) {
      this.logger.error(`Failed to write file ${file_path}:`, error);
      throw new Error(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export class UpdateFileTool extends BaseTool {
  constructor(
    private logger: Logger,
    private allowedPaths: string[]
  ) {
    super();
  }

  get definition(): ToolDefinition {
    return {
      name: 'update_file',
      description: 'Update a file by replacing specific content',
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          description: 'The path to the file to update',
          required: true,
        },
        {
          name: 'search_pattern',
          type: 'string',
          description: 'The text or regex pattern to search for',
          required: true,
        },
        {
          name: 'replacement',
          type: 'string',
          description: 'The text to replace the matched pattern with',
          required: true,
        },
        {
          name: 'use_regex',
          type: 'boolean',
          description: 'Whether to treat search_pattern as a regular expression',
        },
        {
          name: 'replace_all',
          type: 'boolean',
          description: 'Whether to replace all occurrences or just the first one',
        },
      ],
    };
  }

  private isPathAllowed(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    const result = this.allowedPaths.some((allowed) =>
      absolutePath.startsWith(path.resolve(allowed))
    );

    if (!result) {
      this.logger.warn(
        `Path not allowed: ${absolutePath}. Allowed paths: ${this.allowedPaths.map((p) => path.resolve(p)).join(', ')}`
      );
    }

    return result;
  }

  async execute(parameters: {
    file_path: string;
    search_pattern: string;
    replacement: string;
    use_regex?: boolean;
    replace_all?: boolean;
  }): Promise<any> {
    const {
      file_path,
      search_pattern,
      replacement,
      use_regex = false,
      replace_all = true,
    } = parameters;

    if (!this.isPathAllowed(file_path)) {
      throw new Error(
        `Access denied: Path ${file_path} is not in allowed directories. Allowed directories: ${this.allowedPaths.join(', ')}`
      );
    }

    try {
      const content = await fs.readFile(file_path, 'utf8');
      let updatedContent: string;
      let matchCount = 0;

      if (use_regex) {
        const regex = new RegExp(search_pattern, replace_all ? 'g' : '');
        const matches = content.match(new RegExp(search_pattern, 'g'));
        matchCount = matches ? matches.length : 0;
        updatedContent = content.replace(regex, replacement);
      } else {
        if (replace_all) {
          const parts = content.split(search_pattern);
          matchCount = parts.length - 1;
          updatedContent = parts.join(replacement);
        } else {
          matchCount = content.includes(search_pattern) ? 1 : 0;
          updatedContent = content.replace(search_pattern, replacement);
        }
      }

      if (matchCount === 0) {
        throw new Error('No matches found for the search pattern');
      }

      await fs.writeFile(file_path, updatedContent, 'utf8');
      this.logger.info(`Successfully updated file: ${file_path} (${matchCount} replacements)`);

      return {
        success: true,
        path: file_path,
        matches_replaced: matchCount,
        original_size: Buffer.byteLength(content, 'utf8'),
        new_size: Buffer.byteLength(updatedContent, 'utf8'),
      };
    } catch (error) {
      this.logger.error(`Failed to update file ${file_path}:`, error);
      throw new Error(
        `Failed to update file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export class DeleteFileTool extends BaseTool {
  constructor(
    private logger: Logger,
    private allowedPaths: string[]
  ) {
    super();
  }

  get definition(): ToolDefinition {
    return {
      name: 'delete_file',
      description: 'Delete a file from the file system',
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          description: 'The path to the file to delete',
          required: true,
        },
        {
          name: 'confirm',
          type: 'boolean',
          description: 'Confirmation that you want to delete this file',
          required: true,
        },
      ],
    };
  }

  private isPathAllowed(filePath: string): boolean {
    const absolutePath = path.resolve(filePath);
    const result = this.allowedPaths.some((allowed) =>
      absolutePath.startsWith(path.resolve(allowed))
    );

    if (!result) {
      this.logger.warn(
        `Path not allowed: ${absolutePath}. Allowed paths: ${this.allowedPaths.map((p) => path.resolve(p)).join(', ')}`
      );
    }

    return result;
  }

  async execute(parameters: { file_path: string; confirm: boolean }): Promise<any> {
    const { file_path, confirm } = parameters;

    if (!confirm) {
      throw new Error('Deletion not confirmed. Set confirm to true to delete the file.');
    }

    if (!this.isPathAllowed(file_path)) {
      throw new Error(
        `Access denied: Path ${file_path} is not in allowed directories. Allowed directories: ${this.allowedPaths.join(', ')}`
      );
    }

    try {
      const stats = await fs.stat(file_path);
      await fs.unlink(file_path);
      this.logger.info(`Successfully deleted file: ${file_path}`);

      return {
        success: true,
        path: file_path,
        size: stats.size,
        deleted_at: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to delete file ${file_path}:`, error);
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
