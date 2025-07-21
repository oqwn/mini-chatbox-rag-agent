import React, { useState, useEffect } from 'react';
import { conversationApiService, Conversation } from '../services/conversation-api';

interface Project {
  id: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
}

interface ConversationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId?: string;
  onSelectConversation: (sessionId: string) => void;
  onNewConversation: () => void;
}

interface ConversationWithDropdown extends Conversation {
  showProjectDropdown?: boolean;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onToggle,
  currentSessionId,
  onSelectConversation,
  onNewConversation,
}) => {
  const [conversations, setConversations] = useState<ConversationWithDropdown[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'starred' | 'recent'>('recent');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showProjectMenu, setShowProjectMenu] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
      loadProjects();
    }
  }, [isOpen]);

  // Close project menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showProjectMenu !== null) {
        setShowProjectMenu(null);
      }
      if (conversations.some((c) => c.showProjectDropdown)) {
        setConversations((convs) => convs.map((conv) => ({ ...conv, showProjectDropdown: false })));
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showProjectMenu, conversations]);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await conversationApiService.getConversations(100, 0);
      setConversations(response.conversations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const projectsData = await conversationApiService.getProjects();
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const handleStarConversation = async (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    try {
      await conversationApiService.updateConversation(conversation.id!, {
        isStarred: !conversation.isStarred,
      });
      await loadConversations();
    } catch (err) {
      console.error('Failed to star conversation:', err);
    }
  };

  const handleMoveToProject = async (conversationId: number, projectId: number | null) => {
    try {
      await conversationApiService.updateConversation(conversationId, {
        projectId: projectId ?? undefined,
      });
      await loadConversations();
    } catch (err) {
      console.error('Failed to move conversation:', err);
    }
  };

  const toggleProjectDropdown = (conversationId: number) => {
    setConversations((convs) =>
      convs.map((conv) => ({
        ...conv,
        showProjectDropdown: conv.id === conversationId ? !conv.showProjectDropdown : false,
      }))
    );
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      if (editingProject) {
        // Update existing project
        await conversationApiService.updateProject(editingProject.id, {
          name: newProjectName,
        });
      } else {
        // Create new project
        await conversationApiService.createProject({
          name: newProjectName,
          color: '#' + Math.floor(Math.random() * 16777215).toString(16),
          icon: '📁',
        });
      }
      setNewProjectName('');
      setShowProjectModal(false);
      setEditingProject(null);
      await loadProjects();
    } catch (err) {
      console.error('Failed to create/update project:', err);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this project? Conversations will not be deleted.'
      )
    ) {
      return;
    }

    try {
      await conversationApiService.deleteProject(projectId);
      await loadProjects();
      await loadConversations();
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setShowProjectModal(true);
    setShowProjectMenu(null);
  };

  const handleSelectConversation = (sessionId: string) => {
    onSelectConversation(sessionId);
  };

  const handleNewConversation = () => {
    onNewConversation();
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversation: Conversation) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to archive this conversation?')) {
      try {
        await conversationApiService.updateConversation(conversation.id!, { isArchived: true });
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
      if (selectedFilter === 'starred') return conv.isStarred && !conv.isArchived;
      if (selectedFilter === 'recent') return !conv.isArchived;
      return !conv.isArchived;
    })
    .filter((conv) => {
      // Filter by project (null means no project, undefined means all projects)
      if (selectedProjectId !== undefined) {
        if (selectedProjectId === null && conv.projectId !== null) return false;
        if (selectedProjectId !== null && conv.projectId !== selectedProjectId) return false;
      }
      return conv.title?.toLowerCase().includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      // Starred conversations first
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      // Then by last activity
      return (
        new Date(b.lastActivity || b.createdAt || '').getTime() -
        new Date(a.lastActivity || a.createdAt || '').getTime()
      );
    });

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

        {/* Projects Section */}
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Projects</h3>
            <button
              onClick={() => setShowProjectModal(true)}
              className="text-blue-600 hover:text-blue-800"
              title="Create new project"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
          <div className="space-y-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`group flex items-center gap-2 px-2 py-1 rounded text-sm ${
                  selectedProjectId === project.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'hover:bg-gray-100'
                }`}
              >
                <button
                  onClick={() => setSelectedProjectId(project.id)}
                  className="flex-1 text-left flex items-center gap-2"
                >
                  <span style={{ color: project.color }}>{project.icon}</span>
                  <span className="truncate">{project.name}</span>
                </button>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProjectMenu(showProjectMenu === project.id ? null : project.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {showProjectMenu === project.id && (
                    <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg z-20 border">
                      <button
                        onClick={() => handleEditProject(project)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => {
                          handleDeleteProject(project.id);
                          setShowProjectMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 text-red-600"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b space-y-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

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

          {/* Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFilter('recent')}
              className={`flex-1 px-3 py-1 text-sm rounded-lg ${
                selectedFilter === 'recent'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Recent
            </button>
            <button
              onClick={() => setSelectedFilter('starred')}
              className={`flex-1 px-3 py-1 text-sm rounded-lg ${
                selectedFilter === 'starred'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              ⭐ Starred
            </button>
            <button
              onClick={() => setSelectedFilter('all')}
              className={`flex-1 px-3 py-1 text-sm rounded-lg ${
                selectedFilter === 'all'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>
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
                      <div className="flex items-center gap-2">
                        {conversation.isStarred && <span className="text-yellow-500">⭐</span>}
                        <div className="font-medium text-gray-900 truncate flex-1">
                          {conversation.title || 'Untitled Conversation'}
                        </div>
                      </div>
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
                        onClick={(e) => handleStarConversation(e, conversation)}
                        className={`p-1 hover:text-yellow-500 ${
                          conversation.isStarred ? 'text-yellow-500' : 'text-gray-400'
                        }`}
                        title={conversation.isStarred ? 'Unstar conversation' : 'Star conversation'}
                      >
                        <svg
                          className="w-4 h-4"
                          fill={conversation.isStarred ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                          />
                        </svg>
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProjectDropdown(conversation.id!);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Move to project"
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
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                          </svg>
                        </button>
                        {conversation.showProjectDropdown && (
                          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border">
                            <div className="py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToProject(conversation.id!, null);
                                  toggleProjectDropdown(conversation.id!);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
                                  conversation.projectId === null ? 'bg-blue-50' : ''
                                }`}
                              >
                                <span>📄</span>
                                <span>No Project</span>
                              </button>
                              <div className="border-t my-1"></div>
                              {projects.map((project) => (
                                <button
                                  key={project.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMoveToProject(conversation.id!, project.id);
                                    toggleProjectDropdown(conversation.id!);
                                  }}
                                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2 ${
                                    conversation.projectId === project.id ? 'bg-blue-50' : ''
                                  }`}
                                >
                                  <span style={{ color: project.color }}>{project.icon}</span>
                                  <span>{project.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conversation)}
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

        {/* Project Modal */}
        {showProjectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h3>
              <input
                type="text"
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject();
                  if (e.key === 'Escape') {
                    setShowProjectModal(false);
                    setEditingProject(null);
                    setNewProjectName('');
                  }
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowProjectModal(false);
                    setEditingProject(null);
                    setNewProjectName('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingProject ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
