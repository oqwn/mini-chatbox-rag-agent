import React, { useState, useRef, useEffect } from 'react';
import { apiService, ChatMessage } from '../services/api';
import { ragApiService, KnowledgeSource } from '../services/rag-api';
import { useNavigate } from 'react-router-dom';
import { MCPToolsPanel } from '../components/MCPToolsPanel';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { StorageService } from '../services/storage';
import { conversationApiService } from '../services/conversation-api';
import '../styles/markdown.css';

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [showMCPTools, setShowMCPTools] = useState(false);
  const [showConversationSidebar, setShowConversationSidebar] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [selectedKnowledgeSource, setSelectedKnowledgeSource] = useState<number | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for permission button clicks
    const handlePermission = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const decision = customEvent.detail;

      // Continue the existing assistant message instead of creating a new conversation
      if (!isStreaming && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];

        // Only proceed if the last message is from assistant and contains permission request
        if (
          lastMessage.role === 'assistant' &&
          lastMessage.content.includes('[MCP_PERMISSION_REQUEST]')
        ) {
          setError(null);
          setIsStreaming(true);

          // Create a hidden user message for the backend to understand the approval
          // but don't show it in the UI
          const hiddenUserMessage: ChatMessage = { role: 'user', content: decision };
          const messagesToSend = [...messages, hiddenUserMessage];

          // Continue streaming to the existing assistant message
          const abortController = new AbortController();
          abortControllerRef.current = abortController;

          // Keep the permission request in the message - the PermissionCard will show decision state
          // Add a line break after the permission request for the continued response
          const currentContent = lastMessage.content;

          // Update the message to add space for the continued response
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: currentContent + '\n\n',
            };
            return newMessages;
          });

          // Set the streaming content to start after the current content
          streamingContentRef.current = currentContent + '\n\n';

          try {
            const model = currentModel || (await apiService.getSettings()).openai.model;
            await apiService.streamMessage(
              messagesToSend,
              { model },
              (content) => {
                if (abortController.signal.aborted) return;
                streamingContentRef.current += content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = streamingContentRef.current;
                  return newMessages;
                });
              },
              (error) => {
                if (abortController.signal.aborted) return;
                setError(error);
                setIsStreaming(false);
              },
              () => {
                if (abortController.signal.aborted) return;
                streamingContentRef.current = '';
                setIsStreaming(false);
              },
              abortController.signal,
              ragEnabled
            );
          } catch (err) {
            if (!abortController.signal.aborted) {
              setError(err instanceof Error ? err.message : 'Unknown error');
              setIsStreaming(false);
            }
          }
        }
      }
    };

    window.addEventListener('mcp-permission', handlePermission);
    return () => {
      window.removeEventListener('mcp-permission', handlePermission);
    };
  }, [messages, isStreaming, currentModel]);

  // Scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        scrollToBottom();
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  useEffect(() => {
    // Initialize session ID
    const initSession = () => {
      let sessionId = localStorage.getItem('currentSessionId');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('currentSessionId', sessionId);
      }
      setCurrentSessionId(sessionId);
    };

    // Load current model from settings
    const loadModel = async () => {
      try {
        const settings = await apiService.getSettings();
        setCurrentModel(settings.openai.model);
      } catch (err) {
        console.error('Failed to load model:', err);
      }
    };

    // Load knowledge sources for RAG
    const loadKnowledgeSources = async () => {
      try {
        const result = await ragApiService.getKnowledgeSources();
        setKnowledgeSources(result.sources);
      } catch (err) {
        console.error('Failed to load knowledge sources:', err);
      }
    };

    // Load conversation if exists
    const loadConversation = async (sessionId: string) => {
      try {
        const { messages } = await conversationApiService.getMessages(sessionId);
        const chatMessages: ChatMessage[] = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        }));
        setMessages(chatMessages);
      } catch (err) {
        // Conversation doesn't exist yet, that's fine
        console.log('No existing conversation found for session:', sessionId);
      }
    };

    initSession();
    loadModel();
    loadKnowledgeSources();

    // Load conversation after session is initialized
    if (currentSessionId) {
      loadConversation(currentSessionId);
    }

    // Cleanup function to abort ongoing streams
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [currentSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const persistMessage = async (message: ChatMessage) => {
    if (!currentSessionId) return;
    
    try {
      await conversationApiService.addMessage(currentSessionId, {
        role: message.role,
        content: message.content,
        tokenCount: Math.floor(message.content.length / 4), // Rough token estimate
      });
    } catch (err) {
      console.error('Failed to persist message:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming || !currentSessionId) return;

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const messagesToSend = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsStreaming(true);

    // Persist user message
    await persistMessage(userMessage);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantMessage]);

    // Reset streaming content ref
    streamingContentRef.current = '';

    try {
      await apiService.streamMessage(
        messagesToSend,
        currentModel ? { model: currentModel } : undefined,
        (content) => {
          // Check if this stream was aborted
          if (abortController.signal.aborted) return;

          // Accumulate content in ref
          streamingContentRef.current += content;

          // Update UI immediately for better streaming experience
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...newMessages[newMessages.length - 1],
              content: streamingContentRef.current,
            };
            return newMessages;
          });
        },
        (error) => {
          if (abortController.signal.aborted) return;
          setError(error);
          setIsStreaming(false);

          // Check if error indicates no function calling support
          if (error.includes('404 No endpoints found that support tool use')) {
            // Store that this model doesn't support function calling
            if (currentModel) {
              StorageService.setModelCapability(currentModel, false);
            }
          }
        },
        async () => {
          if (abortController.signal.aborted) return;

          // Final update with complete content
          const finalAssistantMessage: ChatMessage = {
            role: 'assistant',
            content: streamingContentRef.current,
          };
          
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = finalAssistantMessage;
            return newMessages;
          });

          // Persist assistant message
          await persistMessage(finalAssistantMessage);

          setIsStreaming(false);

          // If we got here successfully, the model supports function calling
          // (or at least didn't throw the specific error)
          if (currentModel && !error) {
            const capability = StorageService.getModelCapability(currentModel);
            if (!capability) {
              // Only set to true if we haven't recorded it before
              StorageService.setModelCapability(currentModel, true);
            }
          }
        },
        abortController.signal,
        ragEnabled
      );
    } catch (err) {
      if (abortController.signal.aborted) return;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('not configured')) {
        setError('AI service is not configured. Please set up your API key in settings.');
        setMessages((prev) => prev.slice(0, -1)); // Remove empty assistant message
      } else {
        setError(errorMessage);

        // Check if error indicates no function calling support
        if (errorMessage.includes('404 No endpoints found that support tool use')) {
          // Store that this model doesn't support function calling
          if (currentModel) {
            StorageService.setModelCapability(currentModel, false);
          }
        }
      }
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSelectConversation = async (sessionId: string) => {
    // Save current session and load selected conversation
    setCurrentSessionId(sessionId);
    localStorage.setItem('currentSessionId', sessionId);
    
    try {
      const { messages } = await conversationApiService.getMessages(sessionId);
      const chatMessages: ChatMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      setMessages(chatMessages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    }
  };

  const handleNewConversation = () => {
    // Create new session
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSessionId(newSessionId);
    localStorage.setItem('currentSessionId', newSessionId);
    setMessages([]);
    setError(null);
  };

  const handleMCPToolInvoke = async (
    toolName: string,
    serverId: string,
    parameters: Record<string, any>
  ) => {
    try {
      // Show the tool invocation as a system message
      const toolMessage: ChatMessage = {
        role: 'system',
        content: `Invoking tool: ${toolName} with parameters: ${JSON.stringify(parameters, null, 2)}`,
      };
      setMessages((prev) => [...prev, toolMessage]);

      // Invoke the tool
      const result = await apiService.invokeMCPTool(serverId, toolName, parameters);

      // Show the result as a system message
      const resultMessage: ChatMessage = {
        role: 'system',
        content: `Tool result: ${JSON.stringify(result, null, 2)}`,
      };
      setMessages((prev) => [...prev, resultMessage]);

      // Auto-scroll to bottom
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'system',
        content: `Tool invocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        isOpen={showConversationSidebar}
        onToggle={() => setShowConversationSidebar(!showConversationSidebar)}
        currentSessionId={currentSessionId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />

      {/* Sidebar Toggle Button (when collapsed) */}
      {!showConversationSidebar && (
        <div className="flex flex-col">
          <button
            onClick={() => setShowConversationSidebar(true)}
            className="p-3 bg-gray-100 hover:bg-gray-200 border-r text-gray-600 hover:text-gray-900"
            title="Show conversations"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-screen">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowConversationSidebar(!showConversationSidebar)}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
              title="Toggle conversation sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Chat</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/chat/multimodal')}
              className="text-blue-600 hover:text-blue-800 font-medium"
              title="Switch to multimodal chat with file support"
            >
              Multimodal
            </button>
            <button
              onClick={() => setShowMCPTools(true)}
              className="text-gray-600 hover:text-gray-900"
            >
              Tools
            </button>
            <button onClick={() => navigate('/rag')} className="text-gray-600 hover:text-gray-900">
              RAG
            </button>
            <button onClick={() => navigate('/mcp')} className="text-gray-600 hover:text-gray-900">
              MCP
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-gray-600 hover:text-gray-900"
            >
              Settings
            </button>
          </div>
        </div>

        {/* RAG Controls */}
        <div className="mt-3 flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={ragEnabled}
              onChange={(e) => setRagEnabled(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Enable RAG</span>
          </label>

          {ragEnabled && knowledgeSources.length > 0 && (
            <select
              value={selectedKnowledgeSource || ''}
              onChange={(e) =>
                setSelectedKnowledgeSource(e.target.value ? Number(e.target.value) : null)
              }
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="">All sources</option>
              {knowledgeSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          )}

          {ragEnabled && (
            <span className="text-xs text-green-600">
              ✓ RAG enabled - using knowledge base for context
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg mb-2">Welcome to Mini Chatbox!</p>
            <p>Start a conversation by typing a message below.</p>
          </div>
        )}

        {messages.map((message, index) => {
          const isLastMessage = index === messages.length - 1;
          const isStreamingMessage = isLastMessage && message.role === 'assistant' && isStreaming;

          return (
            <div
              key={index}
              className={`mb-4 ${message.role === 'user' ? 'text-right px-6' : message.role === 'system' ? 'px-6' : ''}`}
            >
              <div
                className={`${
                  message.role === 'user'
                    ? 'inline-block px-4 py-2 rounded-lg max-w-2xl'
                    : message.role === 'assistant'
                      ? 'px-4 py-3 rounded-lg'
                      : 'inline-block px-4 py-2 rounded-lg max-w-2xl'
                } ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.role === 'system'
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                      : 'bg-gray-100 text-black'
                }`}
              >
                {message.role === 'assistant' ? (
                  <>
                    <StreamingMarkdown content={message.content} isStreaming={isStreamingMessage} />
                    {!isStreamingMessage && message.content && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={() => handleCopy(message.content, index)}
                          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2 transition-colors"
                          title="Copy response"
                        >
                          {copiedIndex === index ? (
                            <>
                              <svg
                                className="w-4 h-4 text-green-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              <span className="text-green-600">Copied!</span>
                            </>
                          ) : (
                            <>
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
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                )}
              </div>
            </div>
          );
        })}

        {error && (
          <div className="mb-4 px-6">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
              {error.includes('not configured') && (
                <button
                  onClick={() => navigate('/settings')}
                  className="ml-2 underline hover:no-underline"
                >
                  Go to Settings
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-6 py-4 bg-white">
        <div className="flex space-x-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            style={{ minHeight: '44px', maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className={`px-6 py-2 rounded-lg font-medium ${
              !input.trim() || isStreaming
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Send
          </button>
        </div>
      </div>

        {/* MCP Tools Panel */}
        <MCPToolsPanel
          isOpen={showMCPTools}
          onClose={() => setShowMCPTools(false)}
          onToolInvoke={handleMCPToolInvoke}
        />
      </div>
    </div>
  );
};
