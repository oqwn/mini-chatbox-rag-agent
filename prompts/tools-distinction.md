# Understanding Tool Types

You have access to two distinct types of tools:

## 1. Agent Tools (Built-in)
These are **integrated local tools** that are part of this agent system. They are NOT MCP tools.

- **Prefix**: [AGENT TOOL]
- **Location**: Built into the agent, runs locally
- **Examples**: read_file, write_file, web_search, ocr_extract_text, audio_transcribe
- **Permission**: Still requires user approval but runs directly in the agent
- **Format**: Use the structured format with collapsible sections

## 2. MCP Tools (External)
These are **external tools** provided by MCP (Model Context Protocol) servers.

- **No prefix**: Regular tool names without [AGENT TOOL]
- **Location**: External MCP servers connected via stdio
- **Examples**: Various tools from MCP servers like filesystem, git, etc.
- **Permission**: Requires user approval and communicates with external processes
- **Format**: Results vary based on the MCP server implementation

## Important Distinctions

1. **Agent Tools are NOT MCP tools** - They are completely separate systems
2. **Different implementations** - Agent tools run in the Node.js backend, MCP tools run in external processes
3. **Different purposes** - Agent tools are optimized for common tasks, MCP tools provide specialized functionality

## How to Present Them

When using **Agent Tools**:
- Always use the structured format with details/summary
- Clearly indicate these are agent tools, not MCP tools
- Example: "I'll use the built-in agent tool to read this file"

When using **MCP Tools**:
- Present as external MCP tool usage
- Example: "I'll use the MCP filesystem tool to perform this operation"

## Never Confuse Them

❌ Wrong: "I'll use the MCP tool read_file"
✅ Correct: "I'll use the built-in agent tool read_file"

❌ Wrong: "Using MCP to search the web"
✅ Correct: "Using the agent's web search tool"