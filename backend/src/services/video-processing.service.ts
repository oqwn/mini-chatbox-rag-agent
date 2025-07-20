import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { Logger } from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

// Set ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath.path);

export interface VideoMetadata {
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  format: string;
  size: number;
  bitrate?: number;
  codecs: {
    video?: string;
    audio?: string;
  };
}

export interface VideoFrame {
  timestamp: number; // in seconds
  filePath: string;
  width: number;
  height: number;
}

export interface VideoProcessingResult {
  metadata: VideoMetadata;
  thumbnailPath?: string;
  frames?: VideoFrame[];
  audioPath?: string;
  summary?: {
    keyFrames: number;
    hasAudio: boolean;
    estimatedScenes: number;
  };
}

export class VideoProcessingService {
  constructor(private logger: Logger) {}

  /**
   * Process a video file and extract metadata, frames, and audio
   */
  async processVideo(
    videoPath: string,
    options: {
      extractFrames?: boolean;
      frameCount?: number;
      extractAudio?: boolean;
      generateThumbnail?: boolean;
      startTime?: number; // in seconds
      duration?: number; // in seconds
    } = {}
  ): Promise<VideoProcessingResult> {
    try {
      this.logger.info(`Processing video: ${videoPath}`);

      // Get video metadata
      const metadata = await this.getVideoMetadata(videoPath);

      const result: VideoProcessingResult = { metadata };

      // Generate thumbnail if requested
      if (options.generateThumbnail) {
        result.thumbnailPath = await this.generateThumbnail(videoPath, {
          timestamp: options.startTime || metadata.duration * 0.1, // 10% into video
        });
      }

      // Extract frames if requested
      if (options.extractFrames) {
        result.frames = await this.extractFrames(videoPath, {
          count: options.frameCount || 10,
          startTime: options.startTime,
          duration: options.duration,
        });
      }

      // Extract audio if requested
      if (options.extractAudio && metadata.codecs.audio) {
        result.audioPath = await this.extractAudio(videoPath, {
          startTime: options.startTime,
          duration: options.duration,
        });
      }

      // Generate summary
      result.summary = {
        keyFrames: result.frames?.length || 0,
        hasAudio: !!metadata.codecs.audio,
        estimatedScenes: this.estimateScenes(metadata),
      };

      this.logger.info(`Video processing completed for: ${videoPath}`);
      return result;
    } catch (error) {
      this.logger.error(`Video processing failed for ${videoPath}:`, error);
      throw new Error(
        `Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get detailed metadata from a video file
   */
  async getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video metadata: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const stats = require('fs').statSync(videoPath);

        resolve({
          duration: parseFloat(String(metadata.format.duration || '0')),
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: this.parseFPS(videoStream.r_frame_rate || '0/1'),
          format: metadata.format.format_name || 'unknown',
          size: stats.size,
          bitrate: parseInt(String(metadata.format.bit_rate || '0')),
          codecs: {
            video: videoStream.codec_name,
            audio: audioStream?.codec_name,
          },
        });
      });
    });
  }

  /**
   * Generate a thumbnail from video
   */
  async generateThumbnail(
    videoPath: string,
    options: {
      timestamp?: number;
      size?: string;
    } = {}
  ): Promise<string> {
    const dir = path.dirname(videoPath);
    const name = path.basename(videoPath, path.extname(videoPath));
    const thumbnailPath = path.join(dir, `${name}_thumbnail.jpg`);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [options.timestamp || 1],
          filename: path.basename(thumbnailPath),
          folder: dir,
          size: options.size || '320x240',
        })
        .on('end', () => {
          resolve(thumbnailPath);
        })
        .on('error', (err) => {
          reject(new Error(`Thumbnail generation failed: ${err.message}`));
        });
    });
  }

  /**
   * Extract frames from video at regular intervals
   */
  async extractFrames(
    videoPath: string,
    options: {
      count?: number;
      startTime?: number;
      duration?: number;
      interval?: number;
    } = {}
  ): Promise<VideoFrame[]> {
    const metadata = await this.getVideoMetadata(videoPath);
    const frameCount = options.count || 10;
    const startTime = options.startTime || 0;
    const videoDuration = options.duration || metadata.duration - startTime;
    const interval = options.interval || videoDuration / frameCount;

    const dir = path.dirname(videoPath);
    const name = path.basename(videoPath, path.extname(videoPath));
    const framesDir = path.join(dir, `${name}_frames`);

    // Create frames directory
    await fs.mkdir(framesDir, { recursive: true });

    const frames: VideoFrame[] = [];

    for (let i = 0; i < frameCount; i++) {
      const timestamp = startTime + i * interval;
      const framePath = path.join(framesDir, `frame_${i.toString().padStart(3, '0')}.jpg`);

      try {
        await this.extractSingleFrame(videoPath, framePath, timestamp);
        frames.push({
          timestamp,
          filePath: framePath,
          width: metadata.width,
          height: metadata.height,
        });
      } catch (error) {
        this.logger.warn(`Failed to extract frame at ${timestamp}s: ${error}`);
      }
    }

    return frames;
  }

  /**
   * Extract a single frame at specific timestamp
   */
  private async extractSingleFrame(
    videoPath: string,
    outputPath: string,
    timestamp: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Extract audio from video
   */
  async extractAudio(
    videoPath: string,
    options: {
      format?: 'mp3' | 'wav' | 'm4a';
      startTime?: number;
      duration?: number;
    } = {}
  ): Promise<string> {
    const dir = path.dirname(videoPath);
    const name = path.basename(videoPath, path.extname(videoPath));
    const format = options.format || 'wav';
    const audioPath = path.join(dir, `${name}_audio.${format}`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath)
        .noVideo()
        .audioCodec(format === 'wav' ? 'pcm_s16le' : format === 'mp3' ? 'mp3' : 'aac')
        .output(audioPath);

      if (options.startTime !== undefined) {
        command = command.seekInput(options.startTime);
      }

      if (options.duration !== undefined) {
        command = command.duration(options.duration);
      }

      command
        .on('end', () => resolve(audioPath))
        .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Create video preview (short clip)
   */
  async createPreview(
    videoPath: string,
    options: {
      duration?: number;
      startTime?: number;
      scale?: string;
    } = {}
  ): Promise<string> {
    const dir = path.dirname(videoPath);
    const name = path.basename(videoPath, path.extname(videoPath));
    const previewPath = path.join(dir, `${name}_preview.mp4`);

    const duration = options.duration || 30; // 30 second preview
    const startTime = options.startTime || 0;
    const scale = options.scale || '640:360'; // 360p preview

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(startTime)
        .duration(duration)
        .videoFilter(`scale=${scale}`)
        .videoBitrate('500k')
        .audioBitrate('128k')
        .output(previewPath)
        .on('end', () => resolve(previewPath))
        .on('error', (err) => reject(new Error(`Preview creation failed: ${err.message}`)))
        .run();
    });
  }

  /**
   * Validate video file
   */
  async validateVideo(filePath: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size (500MB limit)
      if (stats.size > 500 * 1024 * 1024) {
        return { isValid: false, error: 'Video file too large (max 500MB)' };
      }

      // Try to get metadata to validate format
      const metadata = await this.getVideoMetadata(filePath);
      
      if (!metadata.width || !metadata.height || metadata.duration <= 0) {
        return { isValid: false, error: 'Invalid video format or corrupted file' };
      }

      // Check duration (max 2 hours)
      if (metadata.duration > 7200) {
        return { isValid: false, error: 'Video too long (max 2 hours)' };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Video validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Parse FPS from ffmpeg format (e.g., "30000/1001")
   */
  private parseFPS(fpsString: string): number {
    const parts = fpsString.split('/');
    if (parts.length === 2) {
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(fpsString) || 0;
  }

  /**
   * Estimate number of scenes in video (simple heuristic)
   */
  private estimateScenes(metadata: VideoMetadata): number {
    // Simple estimation: 1 scene per 30 seconds
    return Math.max(1, Math.ceil(metadata.duration / 30));
  }

  /**
   * Get video information for analysis
   */
  async getVideoInfo(videoPath: string): Promise<{
    duration: string;
    resolution: string;
    fileSize: string;
    format: string;
    hasAudio: boolean;
  }> {
    const metadata = await this.getVideoMetadata(videoPath);

    return {
      duration: this.formatDuration(metadata.duration),
      resolution: `${metadata.width}x${metadata.height}`,
      fileSize: this.formatFileSize(metadata.size),
      format: metadata.format,
      hasAudio: !!metadata.codecs.audio,
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