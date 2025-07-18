import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
  serverId: string;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  connected: boolean;
  error?: string;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  process?: ChildProcess;
}

export class MCPService extends EventEmitter {
  private servers: Map<string, MCPServerStatus> = new Map();
  private messageId = 1;

  async connectToServer(serverId: string, config: MCPServerConfig): Promise<void> {
    const status: MCPServerStatus = {
      id: serverId,
      name: serverId, // Use serverId as name (Claude Desktop style)
      connected: false,
      tools: [],
      resources: [],
      prompts: [],
    };

    try {
      // Claude Desktop only uses stdio connections
      await this.connectStdio(serverId, config, status);

      status.connected = true;
      this.servers.set(serverId, status);

      // Discover capabilities after connection
      await this.discoverCapabilities(serverId);

      this.emit('serverConnected', serverId, status);
    } catch (error) {
      status.error = error instanceof Error ? error.message : 'Connection failed';
      status.connected = false;
      this.servers.set(serverId, status);
      this.emit('serverError', serverId, status);
      throw error;
    }
  }

  private async connectStdio(
    serverId: string,
    config: MCPServerConfig,
    status: MCPServerStatus
  ): Promise<void> {
    const childProcess = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
      shell: true,
    });

    status.process = childProcess;

    // Handle process events
    childProcess.on('error', (error: Error) => {
      status.error = error.message;
      status.connected = false;
      this.emit('serverError', serverId, status);
    });

    childProcess.on('exit', (code: number | null) => {
      status.connected = false;
      if (code !== 0) {
        status.error = `Process exited with code ${code}`;
      }
      this.emit('serverDisconnected', serverId, status);
    });

    // Initialize MCP handshake
    await this.initializeMCPHandshake(serverId, childProcess);
  }


  private async initializeMCPHandshake(_serverId: string, process: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP handshake timeout'));
      }, 10000);

      // Send initialize request
      const initRequest = {
        jsonrpc: '2.0',
        id: this.messageId++,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: {
              listChanged: true,
            },
            sampling: {},
          },
          clientInfo: {
            name: 'mini-chatbox-rag-agent',
            version: '1.0.0',
          },
        },
      };

      let responseBuffer = '';

      const handleStdout = (data: Buffer) => {
        responseBuffer += data.toString();

        // Try to parse complete JSON messages
        const lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              if (message.id === initRequest.id) {
                clearTimeout(timeout);
                process.stdout?.removeListener('data', handleStdout);

                if (message.error) {
                  reject(new Error(message.error.message || 'MCP initialization failed'));
                } else {
                  resolve();
                }
              }
            } catch (error) {
              // Ignore parse errors for now
            }
          }
        }
      };

      process.stdout?.on('data', handleStdout);
      process.stdin?.write(JSON.stringify(initRequest) + '\n');
    });
  }

  private async discoverCapabilities(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || !server.connected) {
      return;
    }

    try {
      // Discover tools
      const tools = await this.sendMCPRequest(serverId, 'tools/list', {});
      if (tools?.tools) {
        server.tools = tools.tools.map((tool: any) => ({
          ...tool,
          serverId,
        }));
      }

      // Discover resources
      const resources = await this.sendMCPRequest(serverId, 'resources/list', {});
      if (resources?.resources) {
        server.resources = resources.resources.map((resource: any) => ({
          ...resource,
          serverId,
        }));
      }

      // Discover prompts
      const prompts = await this.sendMCPRequest(serverId, 'prompts/list', {});
      if (prompts?.prompts) {
        server.prompts = prompts.prompts.map((prompt: any) => ({
          ...prompt,
          serverId,
        }));
      }

      this.emit('capabilitiesDiscovered', serverId, server);
    } catch (error) {
      console.error(`Failed to discover capabilities for server ${serverId}:`, error);
    }
  }

  private async sendMCPRequest(serverId: string, method: string, params: any): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server || !server.connected || !server.process) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    return new Promise((resolve, reject) => {
      const requestId = this.messageId++;
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        reject(new Error(`MCP request timeout for ${method}`));
      }, 10000);

      let responseBuffer = '';

      const handleStdout = (data: Buffer) => {
        responseBuffer += data.toString();

        const lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              if (message.id === requestId) {
                clearTimeout(timeout);
                server.process?.stdout?.removeListener('data', handleStdout);

                if (message.error) {
                  reject(new Error(message.error.message || 'MCP request failed'));
                } else {
                  resolve(message.result);
                }
              }
            } catch (error) {
              // Ignore parse errors
            }
          }
        }
      };

      server.process?.stdout?.on('data', handleStdout);
      server.process?.stdin?.write(JSON.stringify(request) + '\n');
    });
  }

  async getServerTools(serverId: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverId);
    return server?.tools || [];
  }

  async getServerResources(serverId: string): Promise<MCPResource[]> {
    const server = this.servers.get(serverId);
    return server?.resources || [];
  }

  async getServerPrompts(serverId: string): Promise<MCPPrompt[]> {
    const server = this.servers.get(serverId);
    return server?.prompts || [];
  }

  async invokeTool(
    serverId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server || !server.connected) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    const tool = server.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found in server ${serverId}`);
    }

    return this.sendMCPRequest(serverId, 'tools/call', {
      name: toolName,
      arguments: parameters,
    });
  }

  async disconnectServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }

    if (server.process) {
      server.process.kill();
    }

    server.connected = false;
    this.servers.delete(serverId);
    this.emit('serverDisconnected', serverId, server);
  }

  async getServerStatus(serverId: string): Promise<MCPServerStatus | null> {
    return this.servers.get(serverId) || null;
  }

  async getAllServers(): Promise<MCPServerStatus[]> {
    return Array.from(this.servers.values());
  }

  async getAllTools(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];
    console.log('Getting all tools from servers:', this.servers.size, 'servers');
    for (const server of this.servers.values()) {
      console.log(`Server ${server.id}: connected=${server.connected}, tools=${server.tools.length}`);
      if (server.connected) {
        tools.push(...server.tools);
      }
    }
    console.log('Total tools found:', tools.length);
    return tools;
  }
}
