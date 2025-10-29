# File System Tool Permissions

## Current Issue
The AI file writing tools have security restrictions that prevent writing to arbitrary locations on the file system. This is intentional for security but can cause confusion.

## Default Allowed Paths
By default, the file system tools can read/write in these directories:
- Current working directory: `/Users/mac/Documents/challenges/mini-chatbox-rag-agent`
- Temporary directories: `/tmp`, `/var/tmp`
- User directories: `/Users` (macOS), `/home` (Linux)

## Configuration Options

### Option 1: Environment Variable (Recommended)
Set the `ALLOWED_FILE_PATHS` environment variable with comma-separated paths:

```bash
export ALLOWED_FILE_PATHS="/Users/mac,/tmp,/path/to/your/project"
```

### Option 2: Update .env file
Add to your `.env` file:
```
ALLOWED_FILE_PATHS=/Users/mac,/tmp,/path/to/your/project,/another/allowed/path
```

### Option 3: Disable Restrictions (Not Recommended for Production)
For development only, you can temporarily allow all paths by modifying the tool registry.

## Troubleshooting Steps

1. **Check Error Message**: The error will show which paths are allowed
2. **Verify Path**: Ensure the path you're writing to starts with an allowed directory
3. **Use Absolute Paths**: Provide full absolute paths to avoid confusion
4. **Test with /tmp**: Try writing to `/tmp/test.txt` first to verify tools work

## Examples

### ✅ Allowed Paths (with default config):
- `/tmp/myfile.txt`
- `/Users/mac/Documents/test.txt`
- `./localfile.txt` (relative to project root)
- `/Users/mac/Desktop/output.json`

### ❌ Restricted Paths:
- `/System/Library/test.txt` (system directory)
- `/etc/hosts` (system configuration)
- `/Applications/test.txt` (applications directory)

## Security Note
These restrictions exist to prevent accidental or malicious file system access. Always be careful when expanding allowed paths in production environments.