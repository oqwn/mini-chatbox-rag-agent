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
    };
    limits: {
        maxFileSize: number;
        maxFileSizeMB: number;
        maxFileSizeDisplay: string;
    };
}
export declare const FILE_CONFIG: SupportedFileTypesConfig;
export declare function getAllSupportedExtensions(): string[];
export declare function isFileTypeSupported(filename: string): boolean;
export declare function getFileExtension(filename: string): string;
//# sourceMappingURL=file-config.d.ts.map