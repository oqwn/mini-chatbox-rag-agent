// Shared file types configuration for backend
export interface FileTypeCategory {
  extensions: string[];
  description: string;
}

export interface SupportedFileTypesConfig {
  supportedFileTypes: {
    documents: FileTypeCategory;
    data: FileTypeCategory;
    code: FileTypeCategory;
    other: FileTypeCategory;
    images: FileTypeCategory;
    videos: FileTypeCategory;
    audio: FileTypeCategory;
  };
  limits: {
    maxFileSize: number;
    maxFileSizeMB: number;
    maxFileSizeDisplay: string;
  };
}

export const FILE_CONFIG: SupportedFileTypesConfig = {
  supportedFileTypes: {
    documents: {
      extensions: ['.pdf', '.docx', '.doc', '.txt', '.md', '.rtf'],
      description: 'Document files',
    },
    data: {
      extensions: ['.json', '.csv', '.tsv', '.xml', '.yaml', '.yml', '.ini', '.conf', '.toml'],
      description: 'Data and configuration files',
    },
    code: {
      extensions: [
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
      ],
      description: 'Source code files',
    },
    other: {
      extensions: ['.log', '.gitignore', '.env', '.properties', '.cfg'],
      description: 'Other text files',
    },
    images: {
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'],
      description: 'Image files',
    },
    videos: {
      extensions: ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv', '.m4v'],
      description: 'Video files',
    },
    audio: {
      extensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'],
      description: 'Audio files',
    },
  },
  limits: {
    maxFileSize: 52428800,
    maxFileSizeMB: 50,
    maxFileSizeDisplay: '50MB',
  },
};

// Helper function to get all supported extensions (documents only - for RAG)
export function getAllSupportedExtensions(): string[] {
  const { supportedFileTypes } = FILE_CONFIG;
  return [
    ...supportedFileTypes.documents.extensions,
    ...supportedFileTypes.data.extensions,
    ...supportedFileTypes.code.extensions,
    ...supportedFileTypes.other.extensions,
  ];
}

// Helper function to get all multimodal extensions (includes media files)
export function getAllMultimodalExtensions(): string[] {
  const { supportedFileTypes } = FILE_CONFIG;
  return [
    ...supportedFileTypes.documents.extensions,
    ...supportedFileTypes.data.extensions,
    ...supportedFileTypes.code.extensions,
    ...supportedFileTypes.other.extensions,
    ...supportedFileTypes.images.extensions,
    ...supportedFileTypes.videos.extensions,
    ...supportedFileTypes.audio.extensions,
  ];
}

// Helper function to check if a file type is supported
export function isFileTypeSupported(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return getAllSupportedExtensions().includes(ext);
}

// Helper function to get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? '.' + parts.pop()!.toLowerCase() : '';
}
