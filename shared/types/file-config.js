"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILE_CONFIG = void 0;
exports.getAllSupportedExtensions = getAllSupportedExtensions;
exports.isFileTypeSupported = isFileTypeSupported;
exports.getFileExtension = getFileExtension;
// Import the JSON config
const supported_file_types_json_1 = __importDefault(require("../supported-file-types.json"));
exports.FILE_CONFIG = supported_file_types_json_1.default;
// Helper function to get all supported extensions
function getAllSupportedExtensions() {
    const { supportedFileTypes } = exports.FILE_CONFIG;
    return [
        ...supportedFileTypes.documents.extensions,
        ...supportedFileTypes.data.extensions,
        ...supportedFileTypes.code.extensions,
        ...supportedFileTypes.other.extensions
    ];
}
// Helper function to check if a file type is supported
function isFileTypeSupported(filename) {
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    return getAllSupportedExtensions().includes(ext);
}
// Helper function to get file extension
function getFileExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
}
//# sourceMappingURL=file-config.js.map