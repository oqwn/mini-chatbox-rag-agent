import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Download, ExternalLink, Code, Eye } from 'lucide-react';

interface CanvasProps {
  html: string;
  title?: string;
  onClose: () => void;
  onUpdate?: (html: string) => void;
  isStreaming?: boolean;
}

export const Canvas: React.FC<CanvasProps> = ({
  html,
  title = 'Canvas',
  onClose,
  isStreaming = false,
}) => {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('code');
  const [displayHtml, setDisplayHtml] = useState('');
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);

  // Live streaming effect
  useEffect(() => {
    if (html !== displayHtml) {
      if (isStreaming) {
        // Mark that streaming has started
        if (!hasStartedStreaming) {
          setHasStartedStreaming(true);
          setViewMode('code'); // Ensure we're in code view when streaming starts
        }
        // Simulate streaming effect
        let currentIndex = displayHtml.length;
        const streamContent = () => {
          if (currentIndex < html.length) {
            setDisplayHtml(html.substring(0, currentIndex + 1));
            currentIndex++;
            setTimeout(streamContent, 10); // Fast streaming
          }
        };
        streamContent();
      } else {
        setDisplayHtml(html);
      }
    }
  }, [html, isStreaming, displayHtml, hasStartedStreaming]);

  // Auto-switch to preview when streaming completes
  useEffect(() => {
    if (hasStartedStreaming && !isStreaming && displayHtml) {
      // Streaming has finished, switch to preview
      setViewMode('preview');
      setHasStartedStreaming(false); // Reset for next streaming session
    }
  }, [isStreaming, hasStartedStreaming, displayHtml]);

  // Update preview when HTML changes
  useEffect(() => {
    if (iframeRef.current && viewMode === 'preview' && displayHtml) {
      // Only update if we have complete HTML or a substantial fragment
      if (
        displayHtml.includes('</html>') ||
        displayHtml.includes('</body>') ||
        displayHtml.length > 100
      ) {
        try {
          const doc = iframeRef.current.contentDocument;
          if (doc) {
            doc.open();
            doc.write(displayHtml);
            doc.close();
          }
        } catch (error) {
          console.warn('Failed to update iframe:', error);
        }
      }
    }
  }, [displayHtml, viewMode]);

  // Auto-scroll code section
  useEffect(() => {
    if (codeRef.current && viewMode === 'code') {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [displayHtml, viewMode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayHtml);
  };

  const handleDownload = () => {
    const blob = new Blob([displayHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    const blob = new Blob([displayHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const syntaxHighlight = (code: string) => {
    return code
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/(&lt;!DOCTYPE[^&gt;]*&gt;)/g, '<span class="text-pink-400">$1</span>')
      .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)/g, '$1<span class="text-blue-400">$2</span>')
      .replace(/([a-zA-Z-]+)(=)/g, '<span class="text-yellow-400">$1</span>$2')
      .replace(/("([^"]*)"|'([^']*)')/g, '<span class="text-green-400">$1</span>');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden shadow-2xl animate-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {isStreaming && (
            <div className="flex items-center space-x-2 text-blue-400 text-sm">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Live</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-2 py-1 rounded flex items-center space-x-1 transition-colors text-xs ${
                viewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-2 py-1 rounded flex items-center space-x-1 transition-colors text-xs ${
                viewMode === 'code' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>Code</span>
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="Copy HTML"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="Download HTML"
          >
            <Download className="w-3 h-3" />
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="Open in New Tab"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'preview' ? (
          /* Preview Section */
          <div className="h-full bg-white">
            <iframe
              ref={iframeRef}
              className="w-full h-full border-none"
              title="HTML Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          /* Code Section */
          <div className="h-full bg-gray-950">
            <div className="h-full overflow-auto p-3">
              <pre
                ref={codeRef}
                className="text-gray-300 font-mono text-xs leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html:
                    syntaxHighlight(displayHtml) +
                    (isStreaming ? '<span class="animate-pulse">|</span>' : ''),
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
