import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

// Set ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath.path);

export interface AudioMetadata {
  duration: number; // in seconds
  format: string;
  codec: string;
  sampleRate: number;
  channels: number;
  bitrate?: number;
  size: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  language?: string;
}

export interface AudioAnalysis {
  loudness: {
    average: number;
    peak: number;
    range: number;
  };
  spectral: {
    centroid: number;
    rolloff: number;
    bandwidth: number;
  };
  features: {
    isSpeech: boolean;
    isMusic: boolean;
    isSilent: boolean;
    hasBackground: boolean;
  };
}

export interface AudioProcessingResult {
  metadata: AudioMetadata;
  transcription?: TranscriptionResult;
  analysis?: AudioAnalysis;
  convertedPath?: string;
  waveformPath?: string;
}

export class AudioProcessingService {
  constructor(private logger: Logger) {}

  /**
   * Process an audio file and extract metadata, transcription, and analysis
   */
  async processAudio(
    audioPath: string,
    options: {
      transcribe?: boolean;
      analyze?: boolean;
      convertToWav?: boolean;
      generateWaveform?: boolean;
      language?: string;
    } = {}
  ): Promise<AudioProcessingResult> {
    try {
      this.logger.info(`Processing audio: ${audioPath}`);

      // Get audio metadata
      const metadata = await this.getAudioMetadata(audioPath);

      const result: AudioProcessingResult = { metadata };

      // Convert to WAV if requested (better for processing)
      let processPath = audioPath;
      if (options.convertToWav && !audioPath.toLowerCase().endsWith('.wav')) {
        result.convertedPath = await this.convertToWav(audioPath);
        processPath = result.convertedPath;
      }

      // Transcribe audio if requested
      if (options.transcribe) {
        try {
          result.transcription = await this.transcribeAudio(processPath, {
            language: options.language,
          });
        } catch (error) {
          this.logger.warn(`Transcription failed for ${audioPath}:`, error);
        }
      }

      // Analyze audio if requested
      if (options.analyze) {
        try {
          result.analysis = await this.analyzeAudio(processPath);
        } catch (error) {
          this.logger.warn(`Audio analysis failed for ${audioPath}:`, error);
        }
      }

      // Generate waveform if requested
      if (options.generateWaveform) {
        try {
          result.waveformPath = await this.generateWaveform(processPath);
        } catch (error) {
          this.logger.warn(`Waveform generation failed for ${audioPath}:`, error);
        }
      }

      this.logger.info(`Audio processing completed for: ${audioPath}`);
      return result;
    } catch (error) {
      this.logger.error(`Audio processing failed for ${audioPath}:`, error);
      throw new Error(
        `Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get detailed metadata from an audio file
   */
  async getAudioMetadata(audioPath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get audio metadata: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!audioStream) {
          reject(new Error('No audio stream found'));
          return;
        }

        const stats = require('fs').statSync(audioPath);

        resolve({
          duration: parseFloat(String(metadata.format.duration || '0')),
          format: metadata.format.format_name || 'unknown',
          codec: audioStream.codec_name || 'unknown',
          sampleRate: parseInt(String(audioStream.sample_rate || '0')),
          channels: audioStream.channels || 0,
          bitrate: parseInt(String(metadata.format.bit_rate || '0')),
          size: stats.size,
        });
      });
    });
  }

  /**
   * Convert audio to WAV format for better processing
   */
  async convertToWav(audioPath: string): Promise<string> {
    const dir = path.dirname(audioPath);
    const name = path.basename(audioPath, path.extname(audioPath));
    const wavPath = path.join(dir, `${name}_converted.wav`);

    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .audioCodec('pcm_s16le')
        .audioChannels(1) // Convert to mono for easier processing
        .audioFrequency(16000) // 16kHz sample rate for speech recognition
        .output(wavPath)
        .on('end', () => resolve(wavPath))
        .on('error', (err) => reject(new Error(`Audio conversion failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Transcribe audio to text
   * Note: This is a placeholder implementation. In production, you would use:
   * - Google Cloud Speech-to-Text API
   * - OpenAI Whisper API
   * - Azure Speech Services
   * - Local Whisper model
   */
  async transcribeAudio(
    audioPath: string,
    options: {
      language?: string;
      model?: string;
    } = {}
  ): Promise<TranscriptionResult> {
    try {
      // Placeholder implementation - integrate with actual transcription service
      this.logger.info(`Transcribing audio: ${audioPath}`);

      // For now, return a mock result
      // In production, replace with actual API calls
      const mockTranscription: TranscriptionResult = {
        text: '[Transcription service not configured - placeholder text]',
        confidence: 0.0,
        language: options.language || 'en',
        segments: [],
      };

      // Example of how to integrate with different services:
      /*
      if (process.env.GOOGLE_CLOUD_API_KEY) {
        return await this.transcribeWithGoogleCloud(audioPath, options);
      } else if (process.env.OPENAI_API_KEY) {
        return await this.transcribeWithWhisper(audioPath, options);
      } else {
        return await this.transcribeWithLocalWhisper(audioPath, options);
      }
      */

      return mockTranscription;
    } catch (error) {
      this.logger.error(`Transcription failed: ${error}`);
      return {
        text: '',
        confidence: 0,
        segments: [],
      };
    }
  }

  /**
   * Analyze audio features (basic analysis using ffmpeg)
   */
  async analyzeAudio(audioPath: string): Promise<AudioAnalysis> {
    try {
      // Get basic audio statistics using ffmpeg
      const stats = await this.getAudioStats(audioPath);
      
      // Basic analysis based on metadata and simple heuristics
      const analysis: AudioAnalysis = {
        loudness: {
          average: stats.meanVolume || 0,
          peak: stats.maxVolume || 0,
          range: (stats.maxVolume || 0) - (stats.meanVolume || 0),
        },
        spectral: {
          centroid: 0, // Would need more advanced analysis
          rolloff: 0,
          bandwidth: 0,
        },
        features: {
          isSpeech: this.detectSpeech(stats),
          isMusic: this.detectMusic(stats),
          isSilent: this.detectSilence(stats),
          hasBackground: false,
        },
      };

      return analysis;
    } catch (error) {
      this.logger.error(`Audio analysis failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get basic audio statistics using ffmpeg
   */
  private async getAudioStats(audioPath: string): Promise<{
    meanVolume?: number;
    maxVolume?: number;
    rms?: number;
  }> {
    return new Promise((resolve, reject) => {
      let meanVolume: number | undefined;
      let maxVolume: number | undefined;

      ffmpeg(audioPath)
        .audioFilters('volumedetect')
        .format('null')
        .output('-')
        .on('stderr', (stderrLine) => {
          // Parse volumedetect output
          const meanMatch = stderrLine.match(/mean_volume: ([-\d.]+) dB/);
          const maxMatch = stderrLine.match(/max_volume: ([-\d.]+) dB/);
          
          if (meanMatch) meanVolume = parseFloat(meanMatch[1]);
          if (maxMatch) maxVolume = parseFloat(maxMatch[1]);
        })
        .on('end', () => {
          resolve({ meanVolume, maxVolume });
        })
        .on('error', (err) => {
          reject(new Error(`Audio stats analysis failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Generate visual waveform from audio
   */
  async generateWaveform(audioPath: string): Promise<string> {
    const dir = path.dirname(audioPath);
    const name = path.basename(audioPath, path.extname(audioPath));
    const waveformPath = path.join(dir, `${name}_waveform.png`);

    return new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .audioFilters([
          'showwavespic=s=800x200:colors=blue'
        ])
        .frames(1)
        .output(waveformPath)
        .on('end', () => resolve(waveformPath))
        .on('error', (err) => reject(new Error(`Waveform generation failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Extract audio segments based on silence detection
   */
  async extractAudioSegments(
    audioPath: string,
    options: {
      silenceThreshold?: number; // in dB
      minSegmentLength?: number; // in seconds
    } = {}
  ): Promise<string[]> {
    const silenceThreshold = options.silenceThreshold || -40;
    const minLength = options.minSegmentLength || 1;

    const dir = path.dirname(audioPath);
    const name = path.basename(audioPath, path.extname(audioPath));
    const segmentsDir = path.join(dir, `${name}_segments`);

    await fs.mkdir(segmentsDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const segments: string[] = [];

      ffmpeg(audioPath)
        .audioFilters(`silencedetect=n=${silenceThreshold}dB:d=${minLength}`)
        .format('null')
        .output('-')
        .on('stderr', (stderrLine) => {
          // Parse silence detection output to create segments
          // This would need more sophisticated parsing in production
          this.logger.debug(`Silence detection: ${stderrLine}`);
        })
        .on('end', () => {
          // For now, just return empty array
          // In production, implement actual segmentation
          resolve(segments);
        })
        .on('error', (err) => {
          reject(new Error(`Audio segmentation failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Validate audio file
   */
  async validateAudio(filePath: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size (100MB limit)
      if (stats.size > 100 * 1024 * 1024) {
        return { isValid: false, error: 'Audio file too large (max 100MB)' };
      }

      // Try to get metadata to validate format
      const metadata = await this.getAudioMetadata(filePath);
      
      if (metadata.duration <= 0 || metadata.sampleRate === 0) {
        return { isValid: false, error: 'Invalid audio format or corrupted file' };
      }

      // Check duration (max 2 hours)
      if (metadata.duration > 7200) {
        return { isValid: false, error: 'Audio too long (max 2 hours)' };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Audio validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Simple speech detection heuristics
   */
  private detectSpeech(stats: { meanVolume?: number; maxVolume?: number }): boolean {
    // Simple heuristic: speech typically has moderate volume levels
    if (!stats.meanVolume || !stats.maxVolume) return false;
    
    const dynamicRange = stats.maxVolume - stats.meanVolume;
    return dynamicRange > 10 && dynamicRange < 40 && stats.meanVolume > -40;
  }

  /**
   * Simple music detection heuristics
   */
  private detectMusic(stats: { meanVolume?: number; maxVolume?: number }): boolean {
    // Simple heuristic: music typically has wider dynamic range
    if (!stats.meanVolume || !stats.maxVolume) return false;
    
    const dynamicRange = stats.maxVolume - stats.meanVolume;
    return dynamicRange > 30 && stats.meanVolume > -30;
  }

  /**
   * Simple silence detection heuristics
   */
  private detectSilence(stats: { meanVolume?: number }): boolean {
    // Simple heuristic: very low volume indicates silence
    return !stats.meanVolume || stats.meanVolume < -60;
  }

  /**
   * Get audio information for analysis
   */
  async getAudioInfo(audioPath: string): Promise<{
    duration: string;
    format: string;
    sampleRate: string;
    channels: string;
    fileSize: string;
  }> {
    const metadata = await this.getAudioMetadata(audioPath);

    return {
      duration: this.formatDuration(metadata.duration),
      format: metadata.format,
      sampleRate: `${metadata.sampleRate} Hz`,
      channels: metadata.channels === 1 ? 'Mono' : metadata.channels === 2 ? 'Stereo' : `${metadata.channels} channels`,
      fileSize: this.formatFileSize(metadata.size),
    };
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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