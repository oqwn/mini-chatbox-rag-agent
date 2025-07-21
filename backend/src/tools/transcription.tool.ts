import { BaseTool, ToolDefinition } from './base.tool';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenAI } from 'openai';

export class AudioTranscriptionTool extends BaseTool {
  private openai: OpenAI | null = null;

  constructor(private logger: Logger, private allowedPaths: string[]) {
    super();
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  get definition(): ToolDefinition {
    return {
      name: 'audio_transcribe',
      description: 'Transcribe audio files to text using speech recognition',
      parameters: [
        {
          name: 'audio_path',
          type: 'string',
          description: 'Path to the audio file to transcribe',
          required: true,
        },
        {
          name: 'language',
          type: 'string',
          description: 'Language code of the audio (e.g., "en", "es", "fr", "zh")',
        },
        {
          name: 'format',
          type: 'string',
          description: 'Output format for the transcription',
          enum: ['text', 'json', 'srt', 'vtt'],
        },
        {
          name: 'timestamp_granularities',
          type: 'array',
          description: 'Timestamp granularities to include (for json format)',
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

  private async getAudioDuration(audioPath: string): Promise<number> {
    // This is a simplified duration estimate based on file size
    // In production, you'd use a library like ffprobe
    const stats = await fs.stat(audioPath);
    const avgBitrate = 128000; // 128 kbps average
    return Math.round((stats.size * 8) / avgBitrate);
  }

  async execute(parameters: { 
    audio_path: string; 
    language?: string;
    format?: string;
    timestamp_granularities?: string[];
  }): Promise<any> {
    const { 
      audio_path, 
      language = 'en',
      format = 'text',
      timestamp_granularities = ['segment']
    } = parameters;

    if (!this.isPathAllowed(audio_path)) {
      throw new Error(`Access denied: Path ${audio_path} is not in allowed directories`);
    }

    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Audio transcription requires OpenAI Whisper API.');
    }

    try {
      // Check if file exists
      await fs.access(audio_path);
      const fileStats = await fs.stat(audio_path);

      // Check file size (Whisper API limit is 25MB)
      if (fileStats.size > 25 * 1024 * 1024) {
        throw new Error('Audio file is too large. Maximum size is 25MB.');
      }

      this.logger.info(`Starting transcription for: ${audio_path}`);

      // Read the audio file
      const audioFile = await fs.readFile(audio_path);

      let transcription: any;

      if (format === 'json' && timestamp_granularities) {
        // Use verbose_json format for detailed output
        const response = await this.openai.audio.transcriptions.create({
          file: new File([audioFile], path.basename(audio_path), { 
            type: this.getMimeType(audio_path) 
          }),
          model: 'whisper-1',
          language,
          response_format: 'verbose_json',
          timestamp_granularities: timestamp_granularities as any,
        });

        transcription = response;
      } else {
        // Use specified format
        const response = await this.openai.audio.transcriptions.create({
          file: new File([audioFile], path.basename(audio_path), { 
            type: this.getMimeType(audio_path) 
          }),
          model: 'whisper-1',
          language,
          response_format: format as any,
        });

        transcription = response;
      }

      const duration = await this.getAudioDuration(audio_path);
      
      this.logger.info(`Transcription completed for: ${audio_path}`);

      return {
        success: true,
        audio_path,
        language,
        format,
        file_size: fileStats.size,
        estimated_duration_seconds: duration,
        transcription: typeof transcription === 'string' ? transcription : transcription.text,
        full_response: format === 'json' ? transcription : undefined,
      };
    } catch (error) {
      this.logger.error(`Transcription failed for ${audio_path}:`, error);
      
      // Fallback to a free alternative if OpenAI fails
      if (error instanceof Error && error.message.includes('API key')) {
        return this.fallbackTranscription(audio_path, language);
      }
      
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'audio/mp4',
      '.mpeg': 'audio/mpeg',
      '.mpga': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.webm': 'audio/webm',
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }

  private async fallbackTranscription(audioPath: string, language: string): Promise<any> {
    // This is a placeholder for a fallback transcription service
    // In production, you might use Google Speech-to-Text, AWS Transcribe, etc.
    this.logger.warn('Using fallback transcription (placeholder)');
    
    const stats = await fs.stat(audioPath);
    
    return {
      success: false,
      audio_path: audioPath,
      language,
      file_size: stats.size,
      error: 'OpenAI API not configured. Please set OPENAI_API_KEY environment variable.',
      suggestion: 'For audio transcription, configure OpenAI API key or use an alternative service.',
    };
  }
}