import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@/utils/decorators';
import { Logger } from 'winston';

@Injectable()
export class PromptService {
  private promptCache = new Map<string, string>();

  constructor(private logger: Logger) {}

  public getPrompt(fileName: string, variables: Record<string, string> = {}): string {
    try {
      if (!this.promptCache.has(fileName)) {
        const promptPath = join(process.cwd(), '..', 'prompts', fileName);
        this.logger.info(`Loading prompt from: ${promptPath}`);
        const content = readFileSync(promptPath, 'utf-8');
        this.promptCache.set(fileName, content);
        this.logger.info(`Successfully loaded prompt from ${fileName}`);
      }

      let prompt = this.promptCache.get(fileName)!;

      // Replace variables in the format {{VARIABLE_NAME}}
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      this.logger.info(`Final prompt content: ${prompt.substring(0, 100)}...`);
      return prompt;
    } catch (error) {
      this.logger.error(`Failed to load prompt ${fileName}:`, error);
      throw new Error(`Failed to load prompt: ${fileName}`);
    }
  }

  public clearCache(): void {
    this.promptCache.clear();
    this.logger.debug('Prompt cache cleared');
  }
}
