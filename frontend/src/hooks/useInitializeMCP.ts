import { useEffect } from 'react';
import { mcpService } from '../services/mcp.service';
import { MCPConfiguration } from '../types/mcp';

export const useInitializeMCP = () => {
  useEffect(() => {
    const initializeMCP = async () => {
      try {
        // Load saved MCP configuration from localStorage
        const savedConfig = localStorage.getItem('mcp-configuration');
        if (savedConfig) {
          const config: MCPConfiguration = JSON.parse(savedConfig);
          await mcpService.loadConfiguration(config);
          console.log('MCP configuration loaded automatically');

          // Sync tools after a short delay to ensure servers are connected
          setTimeout(() => {
            mcpService.syncToolsFromBackend();
          }, 2000);
        }
      } catch (error) {
        console.error('Failed to initialize MCP configuration:', error);
      }
    };

    initializeMCP();

    // Set up periodic sync every 30 seconds
    const interval = setInterval(() => {
      mcpService.syncToolsFromBackend();
    }, 30000);

    return () => clearInterval(interval);
  }, []);
};
