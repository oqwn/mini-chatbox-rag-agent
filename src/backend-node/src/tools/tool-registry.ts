import { Logger } from 'winston';
import { BaseTool } from './base.tool';
import { ReadFileTool, WriteFileTool, UpdateFileTool, DeleteFileTool } from './filesystem.tool';
import { WebSearchTool } from './websearch.tool';
import { OCRTool } from './ocr.tool';
import { AudioTranscriptionTool } from './transcription.tool';

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();
  private allowedPaths: string[];

  constructor(private logger: Logger) {
    // Configure allowed paths from environment or use defaults
    this.allowedPaths = process.env.ALLOWED_FILE_PATHS?.split(',') || [
      process.cwd(), // Current working directory
      '/tmp', // Temporary files
      '/Users', // User directories (macOS)
      '/home', // User directories (Linux)
      '/var/tmp', // Additional temp directory
    ];

    this.logger.info(`File system tools allowed paths: ${this.allowedPaths.join(', ')}`);
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    // File system tools
    this.registerTool(new ReadFileTool(this.logger, this.allowedPaths));
    this.registerTool(new WriteFileTool(this.logger, this.allowedPaths));
    this.registerTool(new UpdateFileTool(this.logger, this.allowedPaths));
    this.registerTool(new DeleteFileTool(this.logger, this.allowedPaths));

    // Web search tool
    this.registerTool(new WebSearchTool(this.logger));

    // OCR tool
    this.registerTool(new OCRTool(this.logger, this.allowedPaths));

    // Audio transcription tool
    this.registerTool(new AudioTranscriptionTool(this.logger, this.allowedPaths));

    this.logger.info(`Registered ${this.tools.size} tools`);
  }

  registerTool(tool: BaseTool): void {
    const definition = tool.definition;
    this.tools.set(definition.name, tool);
    this.logger.debug(`Registered tool: ${definition.name}`);
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): any[] {
    return this.getAllTools().map((tool) => {
      const def = tool.definition;
      return {
        name: def.name,
        description: def.description,
        parameters: {
          type: 'object',
          properties: def.parameters.reduce((props, param) => {
            props[param.name] = {
              type: param.type,
              description: param.description,
              enum: param.enum,
            };
            return props;
          }, {} as any),
          required: def.parameters.filter((p) => p.required).map((p) => p.name),
        },
      };
    });
  }

  async executeTool(name: string, parameters: any): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    try {
      this.logger.info(`Executing tool: ${name}`, { parameters });
      const result = await tool.execute(parameters);
      this.logger.info(`Tool execution successful: ${name}`);
      return result;
    } catch (error) {
      this.logger.error(`Tool execution failed: ${name}`, error);

      // If it's a file system tool with path restrictions, provide helpful error info
      if (error instanceof Error && error.message.includes('Access denied')) {
        this.logger.info(`File system allowed paths: ${this.allowedPaths.join(', ')}`);
      }

      throw error;
    }
  }

  getAllowedPaths(): string[] {
    return [...this.allowedPaths];
  }
}
