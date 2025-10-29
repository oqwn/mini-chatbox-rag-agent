export interface MediaAttachment {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  name: string;
  size: number;
  url?: string; // For preview
  thumbnailUrl?: string;
  processed?: boolean;
  processing?: boolean;
  error?: string;
  analysis?: {
    extractedText?: string;
    metadata?: Record<string, any>;
    description?: string;
  };
}

export interface MultimodalChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: MediaAttachment[];
  timestamp?: number;
  id?: string;
}

export interface MediaProcessingResult {
  success: boolean;
  mediaType: string;
  multimodal: boolean;
  textExtracted: boolean;
  thumbnailGenerated: boolean;
  additionalFiles: number;
  extractedText?: string;
  analysis?: any;
  error?: string;
}
