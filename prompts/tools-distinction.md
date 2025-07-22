# Tool Types

## Agent Tools (Built-in)
- **Prefix**: [AGENT TOOL]
- **Usage**: Direct, no permission needed
- **Format**: Always use `<details>` sections
- **Examples**: read_file, web_search, ocr_extract_text

## MCP Tools (External)  
- **Prefix**: None
- **Usage**: Requires permission workflow
- **Format**: Standard results
- **Examples**: External servers and integrations

## Key Rule
✅ Agent tools: Use immediately with `<details>` format
✅ MCP tools: Show permission request first

❌ Never confuse them - check for [AGENT TOOL] prefix