# Troubleshooting AI File Writing Issues

## Problem
The AI cannot successfully write files due to security restrictions in the agent tools.

## Root Cause
File system tools have built-in path restrictions for security. By default, they only allow writing to:
- Current working directory (project root)
- Temporary directories (`/tmp`, `/var/tmp`)  
- User directories (`/Users` on macOS, `/home` on Linux)

## Quick Solution (For Development)

### Option 1: Use Allowed Locations
Tell the AI to write files to locations that are already allowed:

**✅ Safe locations to use:**
- `./output.txt` (in project root)
- `/tmp/myfile.txt` (temporary directory)
- `/Users/mac/Desktop/myfile.txt` (user desktop)
- `/Users/mac/Documents/myfile.txt` (user documents)

### Option 2: Configure Environment Variable
Set allowed paths in your environment:

```bash
# For this session
export ALLOWED_FILE_PATHS="/Users/mac,/tmp,/path/to/your/desired/location"

# Or add to your shell profile (.bashrc, .zshrc, etc.)
echo 'export ALLOWED_FILE_PATHS="/Users/mac,/tmp,/path/to/your/desired/location"' >> ~/.zshrc
```

### Option 3: Create .env File
Create a `.env` file in the backend directory:

```bash
# backend/.env
ALLOWED_FILE_PATHS=/Users/mac,/tmp,/your/custom/path,/another/path
```

## Detailed Error Diagnosis

When file writing fails, check the backend logs for messages like:
- `Path not allowed: /some/path`
- `Access denied: Path /some/path is not in allowed directories`

The error message will show which directories are currently allowed.

## Testing File Writing

Run this test script to verify file writing works:

```bash
cd backend/src/tools
node test-file-writing.js
```

This will test writing to several common locations.

## Production Security Considerations

⚠️ **Important**: The expanded path permissions (like `/Users`) are suitable for development but should be restricted in production:

```bash
# Production example - more restrictive
ALLOWED_FILE_PATHS=/app/data,/tmp,/var/app-files
```

## Common Issues and Solutions

### Issue: "Access denied" errors
**Solution**: Check that the file path starts with an allowed directory

### Issue: AI doesn't know where it can write
**Solution**: In your prompt, specify allowed locations:
```
"Write the file to /tmp/output.txt or ./output.txt in the project root"
```

### Issue: Path resolution problems
**Solution**: Use absolute paths or clear relative paths like `./filename.txt`

## Example AI Prompts

Instead of:
> "Write a file called data.txt with this content..."

Use:
> "Write a file to /tmp/data.txt with this content..." 
> 
> Or: "Write a file to ./data.txt in the project root with this content..."

## Verification Steps

1. **Check current configuration**:
   - Look in backend logs for "File system tools allowed paths"
   - Verify your desired path is in the list

2. **Test with /tmp**:
   - Ask AI to write a test file to `/tmp/test.txt`
   - This should always work

3. **Use absolute paths**:
   - Provide full paths like `/Users/mac/Desktop/file.txt`
   - Avoid ambiguous relative paths

## Need More Help?

If file writing still doesn't work after these steps:

1. Check backend console/logs for specific error messages
2. Verify the tool is being called (look for "Executing tool: write_file" in logs)
3. Confirm the path you want to write to exists and is writable
4. Try the test script to isolate the issue