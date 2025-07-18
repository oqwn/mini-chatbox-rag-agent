import { MCPConfiguration, MCPServerConfig, MCPServerStatus, MCPTool } from '../types/mcp';
import { apiService } from './api';

class MCPService {
  private configuration: MCPConfiguration | null = null;
  private serverStatuses: Map<string, MCPServerStatus> = new Map();
  private eventListeners: Map<string, (status: MCPServerStatus) => void> = new Map();

  async loadConfiguration(config: MCPConfiguration): Promise<void> {
    this.configuration = config;
    await this.initializeServers();
  }

  private async initializeServers(): Promise<void> {
    if (!this.configuration) return;

    for (const [serverId, serverConfig] of Object.entries(this.configuration.servers)) {
      if (serverConfig.enabled) {
        await this.connectToServer(serverId, serverConfig);
      }
    }
  }

  private async connectToServer(serverId: string, config: MCPServerConfig): Promise<void> {
    const status: MCPServerStatus = {
      id: serverId,
      name: config.name,
      connected: false,
      tools: [],
      resources: [],
      prompts: [],
    };

    try {
      // For SSE connections
      if (config.type === 'sse' && config.url) {
        await this.connectSSE(serverId, config);
      } else {
        // For stdio connections, we'll send the config to the backend
        await this.connectStdio(serverId, config);
      }

      status.connected = true;
      await this.discoverCapabilities(serverId);
    } catch (error) {
      status.error = error instanceof Error ? error.message : 'Connection failed';
      status.connected = false;
    }

    this.serverStatuses.set(serverId, status);
    this.notifyStatusChange(serverId, status);
  }

  private async connectSSE(serverId: string, config: MCPServerConfig): Promise<void> {
    if (!config.url) throw new Error('SSE URL is required');

    // Create SSE connection
    const eventSource = new EventSource(config.url);

    eventSource.onopen = () => {
      console.log(`MCP SSE connection established for ${serverId}`);
    };

    eventSource.onerror = (error) => {
      console.error(`MCP SSE error for ${serverId}:`, error);
      const status = this.serverStatuses.get(serverId);
      if (status) {
        status.connected = false;
        status.error = 'SSE connection failed';
        this.notifyStatusChange(serverId, status);
      }
    };

    eventSource.onmessage = (event) => {
      this.handleMCPMessage(serverId, JSON.parse(event.data));
    };
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

  private handleMCPMessage(serverId: string, message: any): void {
    // Handle incoming MCP messages
    console.log(`MCP message from ${serverId}:`, message);
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
}

export const mcpService = new MCPService();
