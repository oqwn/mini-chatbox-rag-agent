import React, { useState, useEffect } from 'react';
import { apiService, MCPTool } from '../services/api';

interface MCPToolsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onToolInvoke: (
    toolName: string,
    serverId: string,
    parameters: Record<string, any>
  ) => Promise<void>;
}

export const MCPToolsPanel: React.FC<MCPToolsPanelProps> = ({ isOpen, onClose, onToolInvoke }) => {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [invoking, setInvoking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTools();
    }
  }, [isOpen]);

  const loadTools = async () => {
    setLoading(true);
    try {
      const mcpTools = await apiService.getMCPTools();
      setTools(mcpTools);
    } catch (error) {
      console.error('Failed to load MCP tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToolSelect = (tool: MCPTool) => {
    setSelectedTool(tool);
    // Initialize parameters with default values
    const initialParams: Record<string, any> = {};
    if (tool.inputSchema?.properties) {
      Object.entries(tool.inputSchema.properties).forEach(([key, schema]) => {
        if (typeof schema === 'object' && schema !== null && 'default' in schema) {
          initialParams[key] = schema.default;
        } else {
          initialParams[key] = '';
        }
      });
    }
    setParameters(initialParams);
  };

  const handleParameterChange = (key: string, value: any) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
  };

  const handleInvoke = async () => {
    if (!selectedTool) return;

    setInvoking(true);
    try {
      await onToolInvoke(selectedTool.name, selectedTool.serverId, parameters);
      onClose();
    } catch (error) {
      console.error('Failed to invoke tool:', error);
    } finally {
      setInvoking(false);
    }
  };

  const renderParameterInput = (key: string, schema: any) => {
    const type = schema.type || 'string';

    switch (type) {
      case 'boolean':
        return (
          <select
            value={parameters[key] ? 'true' : 'false'}
            onChange={(e) => handleParameterChange(key, e.target.value === 'true')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            value={parameters[key] || ''}
            onChange={(e) => handleParameterChange(key, Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={schema.description || ''}
          />
        );
      case 'array':
        return (
          <textarea
            value={Array.isArray(parameters[key]) ? parameters[key].join('\n') : ''}
            onChange={(e) => handleParameterChange(key, e.target.value.split('\n').filter(Boolean))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
            placeholder="Enter one item per line"
          />
        );
      default:
        return (
          <input
            type="text"
            value={parameters[key] || ''}
            onChange={(e) => handleParameterChange(key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={schema.description || ''}
          />
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">MCP Tools</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : tools.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <p>No MCP tools available.</p>
              <p className="text-sm mt-2">
                Configure MCP servers in the MCP settings to see available tools.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tool Selection */}
              <div>
                <h3 className="font-semibold mb-2">Select Tool</h3>
                <div className="grid gap-2">
                  {tools.map((tool) => (
                    <button
                      key={`${tool.serverId}-${tool.name}`}
                      onClick={() => handleToolSelect(tool)}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        selectedTool?.name === tool.name && selectedTool?.serverId === tool.serverId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-sm text-gray-600">{tool.description}</div>
                      <div className="text-xs text-gray-400 mt-1">Server: {tool.serverId}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter Configuration */}
              {selectedTool && (
                <div>
                  <h3 className="font-semibold mb-2">Configure Parameters</h3>
                  <div className="space-y-3">
                    {selectedTool.inputSchema?.properties ? (
                      Object.entries(selectedTool.inputSchema.properties).map(([key, schema]) => {
                        const isRequired =
                          selectedTool.inputSchema?.required?.includes(key) || false;
                        return (
                          <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {key} {isRequired && <span className="text-red-500">*</span>}
                            </label>
                            {renderParameterInput(key, schema)}
                            {typeof schema === 'object' &&
                              schema !== null &&
                              'description' in schema && (
                                <p className="text-xs text-gray-500 mt-1">{schema.description}</p>
                              )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500">No parameters required for this tool.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {selectedTool && (
          <div className="flex justify-end space-x-2 p-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleInvoke}
              disabled={invoking}
              className={`px-4 py-2 rounded-md font-medium ${
                invoking
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {invoking ? 'Invoking...' : 'Invoke Tool'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
