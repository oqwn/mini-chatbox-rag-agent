import React, { useState, useEffect } from 'react';
import { conversationApiService, Conversation, MemoryStats } from '../services/conversation-api';

interface ConversationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId?: string;
  onSelectConversation: (sessionId: string) => void;
  onNewConversation: () => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onToggle,
  currentSessionId,
  onSelectConversation,
  onNewConversation,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'recent' | 'archived'>('all');

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, selectedFilter]);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await conversationApiService.getConversations(100, 0);
      setConversations(response.conversations);
      setStats(response.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (sessionId: string) => {
    onSelectConversation(sessionId);
  };

  const handleNewConversation = () => {
    onNewConversation();
  };

  const handleDeleteConversation = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to archive this conversation?')) {
      try {
        await conversationApiService.updateConversation(sessionId, { isArchived: true });
        loadConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to archive conversation');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredConversations = conversations
    .filter((conv) => {
      if (selectedFilter === 'archived') return conv.isArchived;
      if (selectedFilter === 'recent') return !conv.isArchived;
      return true;
    })
    .filter(
      (conv) =>
        conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.sessionId.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort(
      (a, b) =>
        new Date(b.lastActivity || b.createdAt || '').getTime() -
        new Date(a.lastActivity || a.createdAt || '').getTime()
    );

  return (
    <div
      className={`transition-all duration-300 ease-in-out ${isOpen ? 'w-80' : 'w-0'} flex-shrink-0`}
    >
      <div
        className={`h-full bg-white border-r shadow-lg flex flex-col overflow-hidden ${isOpen ? 'block' : 'hidden'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Total Conversations</div>
                <div className="font-semibold">{stats.totalConversations}</div>
              </div>
              <div>
                <div className="text-gray-500">Total Messages</div>
                <div className="font-semibold">{stats.totalMessages}</div>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 border-b space-y-3">
          {/* New Conversation Button */}
          <button
            onClick={handleNewConversation}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Conversation
          </button>

          {/* Search */}
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Filter */}
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Conversations</option>
            <option value="recent">Recent</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500">Loading conversations...</div>
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="text-red-600 text-sm">{error}</div>
              <button
                onClick={loadConversations}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Try again
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-500 text-center">
                {searchTerm ? 'No conversations found' : 'No conversations yet'}
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.sessionId}
                  className={`p-4 hover:bg-gray-50 cursor-pointer group ${
                    currentSessionId === conversation.sessionId ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleSelectConversation(conversation.sessionId)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {conversation.title || 'Untitled Conversation'}
                      </div>
                      <div className="text-sm text-gray-500 truncate">{conversation.sessionId}</div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                        <span>{conversation.messageCount || 0} messages</span>
                        <span>
                          {formatDate(conversation.lastActivity || conversation.createdAt || '')}
                        </span>
                      </div>
                      {conversation.memorySummary && (
                        <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {conversation.memorySummary}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conversation.sessionId);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Archive conversation"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {conversation.isArchived && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                        Archived
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500">
            {stats && (
              <>
                {stats.activeConversations} active conversations •
                {stats.totalTokensUsed.toLocaleString()} tokens used
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
