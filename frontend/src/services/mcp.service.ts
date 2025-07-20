import { MCPConfiguration, MCPServerConfig, MCPServerStatus, MCPTool } from '../types/mcp';
import { apiService } from './api';

class MCPService {
  private configuration: MCPConfiguration | null = null;
  private serverStatuses: Map<string, MCPServerStatus> = new Map();
  private eventListeners: Map<string, (status: MCPServerStatus) => void> = new Map();

  async loadConfiguration(config: MCPConfiguration): Promise<void> {
    this.configuration = config;
    await this.initializeServers();
    // After initializing servers, sync tools from the global endpoint
    await this.syncToolsFromBackend();
  }

  private async initializeServers(): Promise<void> {
    if (!this.configuration || !this.configuration.mcpServers) return;

    for (const [serverId, serverConfig] of Object.entries(this.configuration.mcpServers)) {
      await this.connectToServer(serverId, serverConfig);
    }
  }

  private async connectToServer(serverId: string, config: MCPServerConfig): Promise<void> {
    // Apply Claude Desktop defaults
    const serverConfig = {
      ...config,
      type: 'stdio' as const, // Claude Desktop default
      name: serverId, // Use serverId as name
      enabled: true, // Always enabled in Claude Desktop
    };

    const status: MCPServerStatus = {
      id: serverId,
      name: serverConfig.name,
      connected: false,
      tools: [],
      resources: [],
      prompts: [],
    };

    try {
      // Send the config to the backend
      await this.connectStdio(serverId, serverConfig);
      status.connected = true;
      await this.discoverCapabilities(serverId);
    } catch (error) {
      status.error = error instanceof Error ? error.message : 'Connection failed';
      status.connected = false;
    }

    this.serverStatuses.set(serverId, status);
    this.notifyStatusChange(serverId, status);
  }

  private async connectStdio(serverId: string, config: MCPServerConfig): Promise<void> {
    // Send configuration to backend to handle stdio connections
    await apiService.createMCPServer(serverId, config);
  }

  private async discoverCapabilities(serverId: string): Promise<void> {
    try {
      // Discover tools
      const tools = await apiService.getMCPServerTools(serverId);
      this.updateServerTools(serverId, tools);

      // Discover resources
      const resources = await apiService.getMCPServerResources(serverId);
      this.updateServerResources(serverId, resources);

      // Discover prompts
      const prompts = await apiService.getMCPServerPrompts(serverId);
      this.updateServerPrompts(serverId, prompts);
    } catch (error) {
      console.error(`Failed to discover capabilities for ${serverId}:`, error);
    }
  }

  private updateServerTools(serverId: string, tools: MCPTool[]): void {
    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.tools = tools;
      this.notifyStatusChange(serverId, status);
    }
  }

  private updateServerResources(serverId: string, resources: any[]): void {
    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.resources = resources;
      this.notifyStatusChange(serverId, status);
    }
  }

  private updateServerPrompts(serverId: string, prompts: any[]): void {
    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.prompts = prompts;
      this.notifyStatusChange(serverId, status);
    }
  }

  private notifyStatusChange(serverId: string, status: MCPServerStatus): void {
    const listener = this.eventListeners.get(serverId);
    if (listener) {
      listener(status);
    }
  }

  onServerStatusChange(serverId: string, callback: (status: MCPServerStatus) => void): void {
    this.eventListeners.set(serverId, callback);
  }

  getServerStatus(serverId: string): MCPServerStatus | undefined {
    return this.serverStatuses.get(serverId);
  }

  getAllServerStatuses(): MCPServerStatus[] {
    return Array.from(this.serverStatuses.values());
  }

  getAvailableTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const status of this.serverStatuses.values()) {
      if (status.connected) {
        tools.push(...status.tools);
      }
    }
    // console.log('Available MCP tools:', tools);
    // console.log('Server statuses:', Array.from(this.serverStatuses.values()));
    return tools;
  }

  async invokeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    const tool = this.getAvailableTools().find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    return apiService.invokeMCPTool(tool.serverId, toolName, parameters);
  }

  async disconnectServer(serverId: string): Promise<void> {
    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.connected = false;
      this.notifyStatusChange(serverId, status);
    }

    // Notify backend to disconnect
    await apiService.disconnectMCPServer(serverId);

    this.serverStatuses.delete(serverId);
  }

  async syncToolsFromBackend(): Promise<void> {
    try {
      // Get all tools from the backend
      const allTools = await apiService.getMCPTools();

      // Group tools by serverId
      const toolsByServer = new Map<string, MCPTool[]>();
      for (const tool of allTools) {
        if (!toolsByServer.has(tool.serverId)) {
          toolsByServer.set(tool.serverId, []);
        }
        toolsByServer.get(tool.serverId)!.push(tool);
      }

      // Update each server's tools
      for (const [serverId, tools] of toolsByServer) {
        const status = this.serverStatuses.get(serverId);
        if (status) {
          status.tools = tools;
          // console.log(`Updated server ${serverId} with ${tools.length} tools`);
          this.notifyStatusChange(serverId, status);
        }
      }

      // Also try to discover capabilities the traditional way for each server
      for (const serverId of this.serverStatuses.keys()) {
        await this.discoverCapabilities(serverId);
      }
    } catch (error) {
      console.error('Failed to sync tools from backend:', error);
    }
  }
}

export const mcpService = new MCPService();
