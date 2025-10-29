import { Request, Response } from 'express';
import { MCPService } from '../services/mcp.service';

export class MCPController {
  constructor(private mcpService: MCPService) {}

  async createServer(req: Request, res: Response): Promise<void> {
    try {
      const { serverId, config } = req.body;

      if (!serverId || !config) {
        res.status(400).json({ error: 'serverId and config are required' });
        return;
      }

      await this.mcpService.connectToServer(serverId, config);
      res.json({ success: true, message: 'MCP server connected successfully' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to connect to MCP server',
      });
    }
  }

  async getServerTools(req: Request, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      if (!serverId) {
        res.status(400).json({ error: 'serverId is required' });
        return;
      }

      const tools = await this.mcpService.getServerTools(serverId);
      res.json(tools);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get server tools',
      });
    }
  }

  async getServerResources(req: Request, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      if (!serverId) {
        res.status(400).json({ error: 'serverId is required' });
        return;
      }

      const resources = await this.mcpService.getServerResources(serverId);
      res.json(resources);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get server resources',
      });
    }
  }

  async getServerPrompts(req: Request, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      if (!serverId) {
        res.status(400).json({ error: 'serverId is required' });
        return;
      }

      const prompts = await this.mcpService.getServerPrompts(serverId);
      res.json(prompts);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get server prompts',
      });
    }
  }

  async invokeTool(req: Request, res: Response): Promise<void> {
    try {
      const { serverId, toolName } = req.params;
      const { parameters } = req.body;

      if (!serverId || !toolName) {
        res.status(400).json({ error: 'serverId and toolName are required' });
        return;
      }

      const result = await this.mcpService.invokeTool(serverId, toolName, parameters || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to invoke tool',
      });
    }
  }

  async disconnectServer(req: Request, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      if (!serverId) {
        res.status(400).json({ error: 'serverId is required' });
        return;
      }

      await this.mcpService.disconnectServer(serverId);
      res.json({ success: true, message: 'MCP server disconnected successfully' });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to disconnect MCP server',
      });
    }
  }

  async getServerStatus(req: Request, res: Response): Promise<void> {
    try {
      const { serverId } = req.params;

      if (!serverId) {
        res.status(400).json({ error: 'serverId is required' });
        return;
      }

      const status = await this.mcpService.getServerStatus(serverId);
      if (!status) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }

      res.json(status);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get server status',
      });
    }
  }

  async getAllServers(_req: Request, res: Response): Promise<void> {
    try {
      const servers = await this.mcpService.getAllServers();
      res.json(servers);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get all servers',
      });
    }
  }

  async getAllTools(_req: Request, res: Response): Promise<void> {
    try {
      const tools = await this.mcpService.getAllTools();
      res.json(tools);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get all tools',
      });
    }
  }
}
