# Agent Tools Response Format

When using agent tools, present the results in a structured, consistent format that matches the knowledge base search style.

## File Operations

### Read File
<details>
<summary>📄 Read file: [filename]</summary>

**File Information:**
- Path: [full file path]
- Size: [file size]
- Encoding: [encoding used]
- Status: [Success/Failed]

**File Content:**
```[file_extension]
[First several lines of file content...]
[... truncated if file is large ...]
```

**Evaluation:** [Was the file read successfully? Any issues or observations?]
</details>

### Write File
<details>
<summary>📝 Write file: [filename]</summary>

**Operation Details:**
- Path: [full file path]
- Size: [bytes written]
- Encoding: [encoding used]
- Directories Created: [Yes/No]
- Status: [Success/Failed]

**Content Preview:**
```[file_extension]
[First few lines of written content...]
```

**Result:** [File created/updated successfully with X bytes]
</details>

### Update File
<details>
<summary>✏️ Update file: [filename]</summary>

**Update Details:**
- Path: [full file path]
- Search Pattern: `[pattern]`
- Replacement: `[replacement text]`
- Matches Found: [X occurrences]
- Matches Replaced: [Y occurrences]
- Status: [Success/Failed]

**Change Preview:**
```diff
- [old line]
+ [new line]
```

**Result:** [Successfully updated X occurrences in the file]
</details>

### Delete File
<details>
<summary>🗑️ Delete file: [filename]</summary>

**Deletion Details:**
- Path: [full file path]
- Original Size: [file size]
- Confirmed: [Yes/No]
- Deleted At: [timestamp]
- Status: [Success/Failed]

**Result:** [File successfully deleted / Deletion cancelled]
</details>

## Web Search

<details>
<summary>🔍 Web search: "[query]"</summary>

**Search Details:**
- Query: `[search query]`
- Results: Found [X] results
- Search Engine: [Google/DuckDuckGo]
- Search Time: [X.XX seconds]
- Filters: [site:example.com, filetype:pdf, etc.]

**Top Results:**
1. **[Title 1]**
   - URL: [url]
   - Snippet: [preview text...]
   - Source: [domain]

2. **[Title 2]**
   - URL: [url]
   - Snippet: [preview text...]
   - Source: [domain]

**Evaluation:** [Are these results relevant? Should we refine the search?]
</details>

## OCR (Text Extraction)

<details>
<summary>👁️ OCR extract text from: [image_name]</summary>

**OCR Details:**
- Image: [image path]
- Language: [language code - language name]
- Preprocessing: [Enabled/Disabled]
- Confidence: [XX.X%]
- Words Detected: [X words]
- Status: [Success/Failed]

**Extracted Text:**
```
[Extracted text content...]
```

**Quality Assessment:** [Clear text / Some errors / Poor quality - recommendations for improvement]
</details>

## Audio Transcription

<details>
<summary>🎤 Transcribe audio: [audio_name]</summary>

**Transcription Details:**
- Audio: [audio path]
- Language: [language code - language name]
- Duration: [estimated X seconds]
- File Size: [X.X MB]
- Format: [output format]
- Status: [Success/Failed]

**Transcription:**
```
[Transcribed text content...]
```

**Quality Notes:** [Clear audio / Background noise / Multiple speakers - any observations]
</details>

## Error Handling

When a tool operation fails, use this format:

<details>
<summary>❌ [Tool operation] failed: [filename/query]</summary>

**Error Details:**
- Operation: [tool name and action]
- Reason: [error message]
- Suggestion: [how to fix or alternative approach]

**Technical Details:**
```
[Error stack or detailed message]
```

**Next Steps:** [Recommended actions to resolve the issue]
</details>

## Usage Guidelines

1. **Always use the details/summary format** to keep responses organized and scannable
2. **Include relevant metadata** (size, time, confidence scores, etc.)
3. **Show previews** of content when appropriate (first few lines, snippets)
4. **Provide evaluation** of results to guide next steps
5. **Use appropriate emoji** in the summary line for visual scanning
6. **Truncate long content** with clear indication that it's truncated
7. **Include status indicators** (Success/Failed) for clarity

## Example Multi-Tool Response

When using multiple tools in sequence:

<details>
<summary>📄 Read file: config.json</summary>
[... file reading details ...]
</details>

<details>
<summary>✏️ Update file: config.json</summary>
[... update details ...]
</details>

<details>
<summary>🔍 Web search: "json configuration best practices"</summary>
[... search results ...]
</details>

This format ensures consistency across all tool operations and makes it easy for users to scan and understand the results.