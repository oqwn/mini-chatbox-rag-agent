from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import MCPServer, MCPTool
from .serializers import (
    MCPServerSerializer, MCPToolSerializer,
    MCPResourceSerializer, MCPPromptSerializer
)
import time
import logging

logger = logging.getLogger(__name__)


class MCPServerViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = MCPServerSerializer
    queryset = MCPServer.objects.all()
    lookup_field = 'name'  # Allow lookup by name instead of ID

    def create(self, request, *args, **kwargs):
        """Override create to add logging"""
        logger.info(f"Creating MCP server with data: {request.data}")
        try:
            response = super().create(request, *args, **kwargs)
            logger.info(f"Successfully created MCP server: {response.data}")
            return response
        except Exception as e:
            logger.error(f"Failed to create MCP server: {str(e)}")
            raise

    @action(detail=True, methods=['post'])
    def sync_tools(self, request, name=None):
        """Sync tools from MCP server"""
        server = self.get_object()

        # Mock tool sync - in production, this would connect to the MCP server
        synced_tools = [
            {
                'name': f'tool_{i}',
                'description': f'Mock tool {i} from {server.name}',
                'parameters': {
                    'type': 'object',
                    'properties': {
                        'input': {'type': 'string'}
                    }
                }
            }
            for i in range(1, 4)
        ]

        # Create or update tools
        for tool_data in synced_tools:
            MCPTool.objects.update_or_create(
                server=server,
                name=tool_data['name'],
                defaults={
                    'description': tool_data['description'],
                    'parameters': tool_data['parameters'],
                    'is_enabled': True
                }
            )

        return Response({
            'server_id': server.id,
            'server_name': server.name,
            'synced_count': len(synced_tools),
            'tools': synced_tools
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def tools(self, request, name=None):
        """
        GET /api/mcp/servers/{name}/tools/
        Get all tools for an MCP server
        """
        try:
            server = self.get_object()
            tools = server.tools.all()
            serializer = MCPToolSerializer(tools, many=True)
            # Return in a format compatible with frontend expectations
            return Response(serializer.data, status=status.HTTP_200_OK)
        except MCPServer.DoesNotExist:
            return Response({
                'error': f'MCP server "{name}" not found',
                'message': 'The requested MCP server does not exist. It may need to be created first.'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get'])
    def resources(self, request, name=None):
        """
        GET /api/mcp/servers/{name}/resources/
        Get all resources available on an MCP server
        """
        server = self.get_object()

        # Mock resources - in production, this would query the MCP server
        resources = [
            {
                'id': f'resource_{i}',
                'name': f'Resource {i}',
                'type': 'file' if i % 2 == 0 else 'database',
                'uri': f'mcp://{server.name}/resources/{i}',
                'description': f'Mock resource {i} from {server.name}',
                'metadata': {
                    'server_id': server.id,
                    'created_at': time.time()
                }
            }
            for i in range(1, 6)
        ]

        serializer = MCPResourceSerializer(resources, many=True)

        # Return in a format compatible with frontend expectations
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def prompts(self, request, name=None):
        """
        GET /api/mcp/servers/{name}/prompts/
        Get all prompts available on an MCP server
        """
        server = self.get_object()

        # Mock prompts - in production, this would query the MCP server
        prompts = [
            {
                'id': f'prompt_{i}',
                'name': f'Prompt Template {i}',
                'description': f'Mock prompt template {i} from {server.name}',
                'template': f'This is a template for prompt {i}: {{input}}',
                'parameters': {
                    'input': {
                        'type': 'string',
                        'description': 'User input',
                        'required': True
                    }
                }
            }
            for i in range(1, 4)
        ]

        serializer = MCPPromptSerializer(prompts, many=True)

        # Return in a format compatible with frontend expectations
        return Response(serializer.data, status=status.HTTP_200_OK)


class MCPToolViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = MCPToolSerializer
    queryset = MCPTool.objects.all()

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute an MCP tool"""
        tool = self.get_object()

        # Get execution parameters
        parameters = request.data.get('parameters', {})

        # Mock execution - in production, this would call the MCP server
        execution_result = {
            'tool_id': tool.id,
            'tool_name': tool.name,
            'server_name': tool.server.name,
            'parameters': parameters,
            'result': f'Mock execution result for {tool.name} with params: {parameters}',
            'status': 'success',
            'execution_time': 0.5,
            'timestamp': time.time()
        }

        return Response(execution_result, status=status.HTTP_200_OK)
