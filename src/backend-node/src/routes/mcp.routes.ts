import { Router } from 'express';
import { MCPController } from '@/controllers/mcp.controller';

export function createMCPRoutes(mcpController: MCPController): Router {
  const router = Router();

  // Server management
  router.post('/mcp/servers', (req, res) => mcpController.createServer(req, res));
  router.get('/mcp/servers', (req, res) => mcpController.getAllServers(req, res));
  router.get('/mcp/servers/:serverId', (req, res) => mcpController.getServerStatus(req, res));
  router.delete('/mcp/servers/:serverId', (req, res) => mcpController.disconnectServer(req, res));

  // Capability discovery
  router.get('/mcp/servers/:serverId/tools', (req, res) => mcpController.getServerTools(req, res));
  router.get('/mcp/servers/:serverId/resources', (req, res) =>
    mcpController.getServerResources(req, res)
  );
  router.get('/mcp/servers/:serverId/prompts', (req, res) =>
    mcpController.getServerPrompts(req, res)
  );

  // Tool invocation
  router.post('/mcp/tools/:serverId/:toolName', (req, res) => mcpController.invokeTool(req, res));

  // Global endpoints
  router.get('/mcp/tools', (req, res) => mcpController.getAllTools(req, res));

  return router;
}
