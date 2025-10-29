from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import MCPServer, MCPTool
from .serializers import MCPServerSerializer, MCPToolSerializer


class MCPServerViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MCPServerSerializer
    queryset = MCPServer.objects.all()

    @action(detail=True, methods=['post'])
    def sync_tools(self, request, pk=None):
        """Sync tools from MCP server"""
        # TODO: Implement MCP server tool sync
        return Response({'message': 'Tool sync to be implemented'})


class MCPToolViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MCPToolSerializer
    queryset = MCPTool.objects.all()

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute an MCP tool"""
        # TODO: Implement MCP tool execution
        return Response({'message': 'Tool execution to be implemented'})
