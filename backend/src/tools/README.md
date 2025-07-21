# Agent Tools (Built-in)

This directory contains powerful built-in agent tools that extend the AI's capabilities. These are **NOT MCP tools** - they are integrated local tools that run directly within the agent system.

## Available Tools

### 1. File System Tools

#### `read_file`
Read the contents of a file from the file system.
- **Parameters:**
  - `file_path` (string, required): The path to the file to read
  - `encoding` (string, optional): The encoding to use (utf8, base64, hex)

#### `write_file`
Write content to a file on the file system.
- **Parameters:**
  - `file_path` (string, required): The path where the file should be written
  - `content` (string, required): The content to write to the file
  - `encoding` (string, optional): The encoding to use (utf8, base64, hex)
  - `create_directories` (boolean, optional): Whether to create parent directories if they don't exist

#### `update_file`
Update a file by replacing specific content.
- **Parameters:**
  - `file_path` (string, required): The path to the file to update
  - `search_pattern` (string, required): The text or regex pattern to search for
  - `replacement` (string, required): The text to replace the matched pattern with
  - `use_regex` (boolean, optional): Whether to treat search_pattern as a regular expression
  - `replace_all` (boolean, optional): Whether to replace all occurrences or just the first one

#### `delete_file`
Delete a file from the file system.
- **Parameters:**
  - `file_path` (string, required): The path to the file to delete
  - `confirm` (boolean, required): Confirmation that you want to delete this file

### 2. Web Search Tool

#### `web_search`
Search the web for information using Google Search API (with DuckDuckGo fallback).
- **Parameters:**
  - `query` (string, required): The search query
  - `num_results` (number, optional): Number of results to return (1-10)
  - `site` (string, optional): Limit search to a specific site (e.g., "wikipedia.org")
  - `file_type` (string, optional): Filter by file type (e.g., "pdf", "doc")

### 3. OCR Tool

#### `ocr_extract_text`
Extract text from images using OCR (Optical Character Recognition).
- **Parameters:**
  - `image_path` (string, required): Path to the image file to extract text from
  - `language` (string, optional): Language code for OCR (eng, chi_sim, chi_tra, jpn, kor, fra, deu, spa)
  - `preprocess` (boolean, optional): Whether to preprocess the image for better OCR results
  - `output_format` (string, optional): Output format for the extracted text (text, json, tsv)

### 4. Audio Transcription Tool

#### `audio_transcribe`
Transcribe audio files to text using speech recognition (OpenAI Whisper API).
- **Parameters:**
  - `audio_path` (string, required): Path to the audio file to transcribe
  - `language` (string, optional): Language code of the audio (e.g., "en", "es", "fr", "zh")
  - `format` (string, optional): Output format for the transcription (text, json, srt, vtt)
  - `timestamp_granularities` (array, optional): Timestamp granularities to include (for json format)

## Security Features

- **Path Restrictions**: File system tools only work within allowed directories (configured via environment variables)
- **Confirmation Required**: Destructive operations like file deletion require explicit confirmation
- **Error Handling**: All tools include comprehensive error handling and logging

## Configuration

### Environment Variables

```bash
# Allowed paths for file system operations (comma-separated)
ALLOWED_FILE_PATHS=/path/to/project,/tmp

# Google Search API (optional, falls back to DuckDuckGo)
GOOGLE_SEARCH_API_KEY=your-api-key
GOOGLE_SEARCH_ENGINE_ID=your-engine-id

# OpenAI API for audio transcription (optional)
OPENAI_API_KEY=your-openai-api-key
```

## Usage Example

When the AI agent needs to use these built-in tools, it will show a permission request card. Here's an example interaction:

```
User: "Read the contents of config.json"

AI: I'll help you read the contents of config.json using the built-in agent tool.

[MCP_PERMISSION_REQUEST]
TOOL: read_file
DESCRIPTION: [AGENT TOOL] Read the contents of a file from the file system
PURPOSE: To read the config.json file as requested
[/MCP_PERMISSION_REQUEST]

[After approval]

Here are the contents of config.json:
{
  "name": "my-app",
  "version": "1.0.0",
  ...
}
```

## Adding New Tools

To add a new tool:

1. Create a new class extending `BaseTool` in a new file
2. Implement the `definition` getter and `execute` method
3. Register the tool in `tool-registry.ts`

Example:
```typescript
export class MyNewTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'my_new_tool',
      description: 'Description of what the tool does',
      parameters: [
        {
          name: 'param1',
          type: 'string',
          description: 'Description of parameter',
          required: true,
        },
      ],
    };
  }

  async execute(parameters: { param1: string }): Promise<any> {
    // Implementation here
    return { success: true, result: 'data' };
  }
}
```