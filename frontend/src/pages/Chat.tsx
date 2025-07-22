import React, { useState, useRef, useEffect } from 'react';
import { apiService, ChatMessage, estimateTokenCount } from '../services/api';
import { ragApiService, KnowledgeSource } from '../services/rag-api';
import { useNavigate } from 'react-router-dom';
import { MCPToolsPanel } from '../components/MCPToolsPanel';
import { StreamingMarkdown } from '../components/StreamingMarkdown';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { MediaDropZone } from '../components/MediaDropZone';
import { MediaAttachmentPreview } from '../components/MediaAttachmentPreview';
import { MediaAttachment } from '../types/multimodal';
import { StorageService } from '../services/storage';
import { conversationApiService } from '../services/conversation-api';
import { Canvas } from '../components/Canvas';
import { Palette } from 'lucide-react';
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

  // Feature toggles
  const [mcpAutoApprove, setMcpAutoApprove] = useState(false);
  const [agentModeEnabled, setAgentModeEnabled] = useState(false);
  const [canvasMode, setCanvasMode] = useState(false);

  // Multimodal state
  const [pendingAttachments, setPendingAttachments] = useState<MediaAttachment[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);

  // Canvas state
  const [showCanvas, setShowCanvas] = useState(false);
  const [canvasHtml, setCanvasHtml] = useState('');
  const [canvasTitle, setCanvasTitle] = useState('Canvas');
  const [canvasManuallyHidden, setCanvasManuallyHidden] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addOptimisticConversationRef = useRef<
    ((sessionId: string, userMessage?: string) => void) | null
  >(null);
  const navigate = useNavigate();

  // Function to extract HTML from message content
  const extractHtmlFromMessage = (content: string): string | null => {
    // Look for [canvas mode] blocks (highest priority)
    const canvasModeMatch = content.match(/\[canvas mode\]([\s\S]*?)\[\/canvas mode\]/);
    if (canvasModeMatch) {
      return canvasModeMatch[1].trim();
    }

    // Look for HTML code blocks
    const htmlBlockMatch = content.match(/```html\n([\s\S]*?)\n```/);
    if (htmlBlockMatch) {
      return htmlBlockMatch[1];
    }

    // Look for complete HTML documents in the content
    const htmlDocMatch = content.match(/<!DOCTYPE html[\s\S]*<\/html>/);
    if (htmlDocMatch) {
      return htmlDocMatch[0];
    }

    // Look for HTML fragments with style and script
    const htmlFragmentMatch = content.match(/<(html|body|div)[\s\S]*<\/(html|body|div)>/);
    if (htmlFragmentMatch && (content.includes('<style>') || content.includes('<script>'))) {
      return htmlFragmentMatch[0];
    }

    // Look for agent tool results that created HTML files
    const htmlFileMatch = content.match(/Write: ([^\\s\\n]*\.html)|"path":\\s*"([^"]*\.html)"/);
    if (htmlFileMatch && content.includes('success')) {
      // When AI writes HTML files, we should prompt them to also show the content
      // For now, encourage the AI to include HTML in response
      const filename = htmlFileMatch[1] || htmlFileMatch[2];

      // Try to extract any HTML that might be in the same response
      const htmlInResponse = content.match(/<!DOCTYPE html[\s\S]*?<\/html>/);
      if (htmlInResponse) {
        return htmlInResponse[0];
      }

      // If no HTML content found, create a prompt for the AI
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HTML File Created</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 40px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 80vh;
        }
        .container {
            text-align: center;
            background: rgba(255,255,255,0.15);
            padding: 40px;
            border-radius: 20px;
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.2);
            animation: slideIn 0.5s ease-out;
        }
        .icon { font-size: 3em; margin-bottom: 20px; }
        h1 { font-size: 2em; margin-bottom: 15px; }
        p { font-size: 1.1em; opacity: 0.9; margin: 10px 0; }
        .filename { 
            background: rgba(255,255,255,0.2);
            padding: 8px 12px;
            border-radius: 6px;
            font-family: monospace;
            margin: 15px 0;
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📄</div>
        <h1>HTML File Created Successfully!</h1>
        <div class="filename">${filename}</div>
        <p>The AI has created an HTML file. To see the content in Canvas, ask the AI to show the HTML code as well!</p>
        <p style="opacity: 0.7; font-size: 0.9em; margin-top: 20px;">
            Try asking: "Please show me the content of the HTML file you just created"
        </p>
    </div>
</body>
</html>`;
    }

    return null;
  };

  useEffect(() => {
    scrollToBottom();

    // Check if the latest AI message contains HTML and update Canvas in real-time
    if (messages.length > 0 && canvasMode) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const html = extractHtmlFromMessage(lastMessage.content);
        if (html) {
          // Always update canvas HTML for live streaming
          if (html !== canvasHtml) {
            setCanvasHtml(html);
          }

          // Extract title from HTML if possible
          const titleMatch = html.match(/<title>([^<]*)<\/title>/);
          if (titleMatch && titleMatch[1] !== canvasTitle) {
            setCanvasTitle(titleMatch[1] || 'Canvas');
          }

          // Auto-show canvas when HTML is detected (unless manually hidden)
          if (!showCanvas && !canvasManuallyHidden) {
            setShowCanvas(true);
          }
        }
      }
    }
  }, [messages, canvasHtml, canvasMode, canvasTitle, showCanvas, canvasManuallyHidden]);

  useEffect(() => {
    // Listen for open canvas events
    const handleOpenCanvas = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { html, title } = customEvent.detail;
      setCanvasHtml(html);
      setCanvasTitle(title);
      setShowCanvas(true);
      setCanvasManuallyHidden(false);
    };

    window.addEventListener('open-canvas', handleOpenCanvas);
    return () => {
      window.removeEventListener('open-canvas', handleOpenCanvas);
    };
  }, []);

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
              ragEnabled,
              mcpAutoApprove
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
  }, [messages, isStreaming, currentModel, mcpAutoApprove]);

  // Auto-approve permission requests when mcpAutoApprove is enabled
  useEffect(() => {
    if (mcpAutoApprove && !isStreaming && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      // Check if the last message contains a permission request
      if (
        lastMessage.role === 'assistant' &&
        lastMessage.content.includes('[MCP_PERMISSION_REQUEST]') &&
        lastMessage.content.includes('[/MCP_PERMISSION_REQUEST]')
      ) {
        // Trigger auto-approval after a short delay to show the card
        const timer = setTimeout(() => {
          const event = new CustomEvent('mcp-permission', { detail: 'approve' });
          window.dispatchEvent(event);
        }, 500); // 500ms delay to show the card briefly

        return () => clearTimeout(timer);
      }
    }
  }, [messages, mcpAutoApprove, isStreaming]);

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

      // Note: Optimistic update will be triggered when user sends first message
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
        const chatMessages: ChatMessage[] = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          tokenCount: msg.tokenCount || estimateTokenCount(msg.content),
        }));
        setMessages(chatMessages);
      } catch (err) {
        // Conversation doesn't exist yet, that's fine
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

  const handleFilesSelected = (files: File[]) => {
    const newAttachments: MediaAttachment[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      type: getMediaType(file.name),
      name: file.name,
      size: file.size,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      processing: false,
      processed: false,
    }));

    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  };

  const getMediaType = (filename: string): 'image' | 'video' | 'audio' | 'document' => {
    const ext = filename.toLowerCase().split('.').pop() || '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg'].includes(ext)) {
      return 'image';
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv', 'm4v'].includes(ext)) {
      return 'video';
    }
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      return 'audio';
    }
    return 'document';
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const attachment = prev.find((att) => att.id === id);
      if (attachment?.url) {
        URL.revokeObjectURL(attachment.url);
      }
      return prev.filter((att) => att.id !== id);
    });
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
    if (
      (!input.trim() && pendingAttachments.length === 0) ||
      isStreaming ||
      processingFiles ||
      !currentSessionId
    )
      return;

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim() || '[Media files attached]',
      tokenCount: estimateTokenCount(input.trim() || '[Media files attached]'),
      attachments: pendingAttachments.map((att) => ({
        id: att.id,
        name: att.name,
        type: att.type,
        size: att.size,
      })),
    };
    const messagesToSend = [...messages, userMessage];
    const isFirstMessage = messages.length === 0;

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setCanvasManuallyHidden(false); // Reset manual hide flag on new message
    setIsStreaming(true);

    // Trigger optimistic update in sidebar for first message in conversation
    if (isFirstMessage && addOptimisticConversationRef.current) {
      addOptimisticConversationRef.current(currentSessionId, userMessage.content);
    }
    // Only set processingFiles to true if we have files to process
    if (pendingAttachments.length > 0) {
      setProcessingFiles(true);
    }

    // Persist user message
    await persistMessage(userMessage);

    const assistantMessage: ChatMessage = { role: 'assistant', content: '', tokenCount: 0 };
    setMessages((prev) => [...prev, assistantMessage]);

    // Reset streaming content ref
    streamingContentRef.current = '';

    try {
      // Extract files from attachments
      const files = pendingAttachments.map((att) => att.file);

      // Clear pending attachments
      setPendingAttachments([]);

      // Use multimodal streaming if files are present
      if (files.length > 0) {
        await apiService.streamMessageWithMedia(
          messagesToSend,
          files,
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
                tokenCount: estimateTokenCount(streamingContentRef.current),
              };
              return newMessages;
            });
          },
          (error) => {
            if (abortController.signal.aborted) return;
            setError(error);
            setIsStreaming(false);
            setProcessingFiles(false);

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

            // Final update with complete content and token count
            const finalAssistantMessage: ChatMessage = {
              role: 'assistant',
              content: streamingContentRef.current,
              tokenCount: estimateTokenCount(streamingContentRef.current),
            };

            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = finalAssistantMessage;
              return newMessages;
            });

            // Persist assistant message
            await persistMessage(finalAssistantMessage);

            setIsStreaming(false);
            setProcessingFiles(false);

            // If we got here successfully, the model supports function calling
            if (currentModel && !error) {
              const capability = StorageService.getModelCapability(currentModel);
              if (!capability) {
                StorageService.setModelCapability(currentModel, true);
              }
            }
          },
          abortController.signal,
          ragEnabled,
          mcpAutoApprove,
          canvasMode
        );
      } else {
        // Use regular text streaming
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
                tokenCount: estimateTokenCount(streamingContentRef.current),
              };
              return newMessages;
            });
          },
          (error) => {
            if (abortController.signal.aborted) return;
            setError(error);
            setIsStreaming(false);
            setProcessingFiles(false);

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

            // Final update with complete content and token count
            const finalAssistantMessage: ChatMessage = {
              role: 'assistant',
              content: streamingContentRef.current,
              tokenCount: estimateTokenCount(streamingContentRef.current),
            };

            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = finalAssistantMessage;
              return newMessages;
            });

            // Persist assistant message
            await persistMessage(finalAssistantMessage);

            setIsStreaming(false);
            setProcessingFiles(false);

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
          ragEnabled,
          mcpAutoApprove,
          canvasMode
        );
      }
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
      setProcessingFiles(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isStreaming) {
        handleInterrupt();
      } else if (input.trim()) {
        handleSend();
      }
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
      const chatMessages: ChatMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        tokenCount: msg.tokenCount || estimateTokenCount(msg.content),
      }));
      setMessages(chatMessages);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    }
  };

  const handleNewConversation = (addToSidebar?: boolean) => {
    // Create new session
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSessionId(newSessionId);
    localStorage.setItem('currentSessionId', newSessionId);
    setMessages([]);
    setError(null);

    // Trigger optimistic update in sidebar if requested
    if (addToSidebar && addOptimisticConversationRef.current) {
      addOptimisticConversationRef.current(newSessionId); // No message for manual creation
    }
  };

  const handleCurrentConversationDeleted = () => {
    // Clear the current conversation and create a new one
    setMessages([]);
    setError(null);
    // Create a new session
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSessionId(newSessionId);
    localStorage.setItem('currentSessionId', newSessionId);

    // Note: Optimistic update will be triggered when user sends first message
  };

  const handleInterrupt = () => {
    // Abort the current stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Update state
    setIsStreaming(false);
    setError(null);

    // Persist the partial message if it has content
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content.trim()) {
      persistMessage(lastMessage);
    }
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
    <MediaDropZone onFilesSelected={handleFilesSelected} disabled={isStreaming || processingFiles}>
      <div className="flex h-screen">
        {/* Conversation Sidebar */}
        <ConversationSidebar
          isOpen={showConversationSidebar}
          onToggle={() => setShowConversationSidebar(!showConversationSidebar)}
          currentSessionId={currentSessionId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={() => handleNewConversation(true)}
          onCurrentConversationDeleted={handleCurrentConversationDeleted}
          onAddOptimisticConversation={(callback) => {
            addOptimisticConversationRef.current = callback;
          }}
        />

        {/* Main Content Area */}
        <div className="flex flex-1 h-screen gap-0">
          {/* Chat Area */}
          <div
            className={`flex flex-col transition-all duration-300 ${
              showCanvas ? 'flex-1' : 'w-full'
            } min-w-0`}
          >
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </button>
                  <h1 className="text-xl font-semibold">
                    <span className="text-blue-600">Multimodal</span> Chatbox
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setShowMCPTools(true)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    Tools
                  </button>
                  <button
                    onClick={() => navigate('/rag')}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    RAG
                  </button>
                  <button
                    onClick={() => navigate('/mcp')}
                    className="text-gray-600 hover:text-gray-900"
                  >
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

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={canvasMode}
                    onChange={(e) => setCanvasMode(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Canvas Mode</span>
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
                  <p className="text-lg mb-2">Welcome to Multimodal Chat!</p>
                  <p>Start a conversation by typing a message or uploading files below.</p>
                  <p className="text-sm mt-2 text-gray-400">
                    Supports images, videos, audio, and documents with OCR and analysis.
                  </p>
                </div>
              )}

              {messages.map((message, index) => {
                const isLastMessage = index === messages.length - 1;
                const isStreamingMessage =
                  isLastMessage && message.role === 'assistant' && isStreaming;

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
                      {/* Attachments for user messages */}
                      {message.role === 'user' &&
                        message.attachments &&
                        message.attachments.length > 0 && (
                          <div className="mb-3 space-y-2">
                            {message.attachments.map((attachment) => (
                              <div
                                key={attachment.id}
                                className="text-sm bg-blue-500 bg-opacity-20 rounded p-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{attachment.name}</span>
                                  <span className="text-xs opacity-75">({attachment.type})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      {message.role === 'assistant' ? (
                        <div className="relative">
                          {/* Vertical line indicator during streaming */}
                          {isStreamingMessage && (
                            <div className="absolute -left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-300 rounded-full opacity-75 animate-pulse" />
                          )}

                          <StreamingMarkdown
                            content={message.content}
                            isStreaming={isStreamingMessage}
                            mcpAutoApprove={mcpAutoApprove}
                          />

                          {/* Always show copy button and token counter at bottom when there's content */}
                          {message.content && (
                            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                              {/* Token counter */}
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                  />
                                </svg>
                                <span className="font-mono">
                                  {isStreamingMessage && message.tokenCount
                                    ? `~${message.tokenCount} tokens`
                                    : `${message.tokenCount || 0} tokens`}
                                </span>
                              </div>

                              {/* Copy button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent interrupting stream
                                  handleCopy(message.content, index);
                                }}
                                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2 transition-colors px-2 py-1 rounded hover:bg-gray-50"
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
                        </div>
                      ) : (
                        <div>
                          <div className="whitespace-pre-wrap break-words">{message.content}</div>
                          {/* Show token count for user messages too */}
                          {message.role === 'user' && message.tokenCount && (
                            <div className="mt-2 text-xs text-blue-200 font-mono text-right">
                              {message.tokenCount} tokens
                            </div>
                          )}
                        </div>
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

            {/* Pending Attachments */}
            {pendingAttachments.length > 0 && (
              <div className="border-t px-6 py-3 bg-gray-50">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">
                    Attachments ({pendingAttachments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pendingAttachments.map((attachment) => (
                      <MediaAttachmentPreview
                        key={attachment.id}
                        attachment={attachment}
                        onRemove={() => removeAttachment(attachment.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t px-6 py-4 bg-white">
              {/* Status indicator during streaming */}
              {isStreaming && (
                <div className="mb-3 text-xs text-gray-500 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>AI is responding...</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <span>Press Enter or click Stop to interrupt</span>
                </div>
              )}
              <div className="flex space-x-4">
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      pendingAttachments.length > 0
                        ? 'Add a message to your attachments...'
                        : isStreaming
                          ? 'Type your next message...'
                          : 'Type your message or drag files here...'
                    }
                    disabled={isStreaming || processingFiles}
                    rows={1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = target.scrollHeight + 'px';
                    }}
                  />

                  {/* Feature icons */}
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {/* Auto Approve MCP icon */}
                    <button
                      onClick={() => setMcpAutoApprove(!mcpAutoApprove)}
                      disabled={isStreaming || processingFiles}
                      className={`p-2 rounded-md transition-colors disabled:text-gray-300 ${
                        mcpAutoApprove
                          ? 'text-green-600 hover:text-green-700 bg-green-50'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title={`MCP Auto Approve: ${mcpAutoApprove ? 'Enabled' : 'Disabled'}`}
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
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </button>

                    {/* Canvas Mode icon */}
                    <button
                      onClick={() => {
                        setCanvasMode(!canvasMode);
                        setCanvasManuallyHidden(false); // Reset when toggling Canvas mode
                      }}
                      disabled={isStreaming || processingFiles}
                      className={`p-2 rounded-md transition-colors disabled:text-gray-300 ${
                        canvasMode
                          ? 'text-purple-600 hover:text-purple-700 bg-purple-50'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title={`Canvas Mode: ${canvasMode ? 'Enabled - AI will respond with HTML' : 'Disabled - Click to enable HTML responses'}`}
                    >
                      <Palette className="w-4 h-4" />
                    </button>

                    {/* Agent Mode icon */}
                    <button
                      onClick={() => setAgentModeEnabled(!agentModeEnabled)}
                      disabled={isStreaming || processingFiles}
                      className={`p-2 rounded-md transition-colors disabled:text-gray-300 ${
                        agentModeEnabled
                          ? 'text-blue-600 hover:text-blue-700 bg-blue-50'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                      title={`Agent Mode: ${agentModeEnabled ? 'Enabled' : 'Disabled'}`}
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
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </button>

                    {/* File input button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isStreaming || processingFiles}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:text-gray-300"
                      title="Attach files"
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
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFilesSelected(Array.from(e.target.files));
                      }
                    }}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md,.json,.csv"
                  />
                </div>
                <button
                  onClick={isStreaming ? handleInterrupt : handleSend}
                  disabled={!isStreaming && !input.trim() && pendingAttachments.length === 0}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isStreaming
                      ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                      : !input.trim() && pendingAttachments.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isStreaming ? (
                    <div className="flex items-center gap-2">
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
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 10h6v4H9z"
                        />
                      </svg>
                      Stop
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
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
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                      Send
                    </div>
                  )}
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

          {/* Canvas Panel */}
          {showCanvas && (
            <div className="w-1/2 min-w-[500px] h-full border-l border-gray-200">
              <Canvas
                html={canvasHtml}
                title={canvasTitle}
                onClose={() => {
                  setShowCanvas(false);
                  setCanvasManuallyHidden(true);
                }}
                onUpdate={(newHtml) => setCanvasHtml(newHtml)}
                isStreaming={isStreaming && canvasMode}
              />
            </div>
          )}
        </div>
      </div>
    </MediaDropZone>
  );
};
