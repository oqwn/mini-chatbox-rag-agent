import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MCPConfiguration, MCPServerStatus } from '../types/mcp';
import { mcpService } from '../services/mcp.service';

export const MCP: React.FC = () => {
  const [configuration, setConfiguration] = useState<string>('');
  const [serverStatuses, setServerStatuses] = useState<MCPServerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  // Example configuration template (Claude Desktop format)
  const exampleConfig = {
    mcpServers: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
      },
      github: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: 'your-github-token',
        },
      },
      sqlite: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '/path/to/database.db'],
      },
    },
  };

  useEffect(() => {
    // Load existing configuration if any
    const savedConfig = localStorage.getItem('mcp-configuration');
    if (savedConfig) {
      setConfiguration(savedConfig);
    } else {
      // Set example configuration
      setConfiguration(JSON.stringify(exampleConfig, null, 2));
    }

    // Load server statuses
    loadServerStatuses();
  }, []);

  const loadServerStatuses = () => {
    const statuses = mcpService.getAllServerStatuses();
    setServerStatuses(statuses);
  };

  const handleLoadConfiguration = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Validate JSON
      const config: MCPConfiguration = JSON.parse(configuration);

      // Basic validation
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        throw new Error('Configuration must have an "mcpServers" object');
      }

      // Validate server configurations
      for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
        // Claude Desktop format defaults
        if (!serverConfig.command) {
          throw new Error(`Server "${serverId}" must have a "command" property`);
        }
      }

      // Save configuration exactly as provided (no normalization)
      localStorage.setItem('mcp-configuration', configuration);

      // Load configuration into MCP service
      await mcpService.loadConfiguration(config);

      setSuccessMessage('MCP configuration loaded successfully!');

      // Refresh server statuses and sync tools
      setTimeout(async () => {
        loadServerStatuses();
        // Sync tools again to ensure they're properly loaded
        await mcpService.syncToolsFromBackend();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectServer = async (serverId: string) => {
    try {
      await mcpService.disconnectServer(serverId);
      loadServerStatuses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect server');
    }
  };

  const insertExampleConfig = () => {
    setConfiguration(JSON.stringify(exampleConfig, null, 2));
  };

  const clearConfiguration = () => {
    setConfiguration('');
    localStorage.removeItem('mcp-configuration');
    setServerStatuses([]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">MCP Configuration</h1>
        <button onClick={() => navigate('/chat')} className="text-gray-600 hover:text-gray-900">
          Back to Chat
        </button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Description */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-2">Model Context Protocol (MCP)</h2>
            <p className="text-blue-700 text-sm">
              Configure MCP servers to extend the chat with external tools and capabilities. Uses
              the same configuration format as Claude Desktop. Connect to filesystem tools,
              databases, APIs, and more.
            </p>
          </div>

          {/* Configuration Editor */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Configuration JSON</h3>
              <div className="space-x-2">
                <button
                  onClick={insertExampleConfig}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Example
                </button>
                <button
                  onClick={clearConfiguration}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Clear
                </button>
              </div>
            </div>

            <textarea
              value={configuration}
              onChange={(e) => setConfiguration(e.target.value)}
              placeholder="Enter your MCP configuration JSON here..."
              className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={handleLoadConfiguration}
                disabled={isLoading || !configuration.trim()}
                className={`px-6 py-2 rounded-lg font-medium ${
                  isLoading || !configuration.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Loading...' : 'Load Configuration'}
              </button>

              {error && <div className="text-red-600 text-sm">{error}</div>}

              {successMessage && <div className="text-green-600 text-sm">{successMessage}</div>}
            </div>
          </div>

          {/* Server Status */}
          {serverStatuses.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Connected Servers</h3>
              <div className="space-y-3">
                {serverStatuses.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          server.connected ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <div>
                        <div className="font-medium">{server.name}</div>
                        <div className="text-sm text-gray-500">
                          {server.tools.length} tools, {server.resources.length} resources
                        </div>
                        {server.error && (
                          <div className="text-sm text-red-500">Error: {server.error}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDisconnectServer(server.id)}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Tools */}
          {serverStatuses.some((s) => s.tools.length > 0) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Available Tools</h3>
              <div className="space-y-2">
                {serverStatuses.flatMap((server) =>
                  server.tools.map((tool) => (
                    <div
                      key={`${server.id}-${tool.name}`}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{tool.name}</div>
                        <div className="text-sm text-gray-500">{tool.description}</div>
                        <div className="text-xs text-gray-400">Server: {server.name}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {tool.inputSchema.required?.length || 0} required params
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
