import React, { useState, useRef, useEffect } from 'react';
import { X, Copy, Download, ExternalLink, Code, Eye } from 'lucide-react';

interface CanvasProps {
  html: string;
  title?: string;
  onClose: () => void;
  onUpdate?: (html: string) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ html, title = 'Canvas', onClose }) => {
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [localHtml, setLocalHtml] = useState(html);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setLocalHtml(html);
  }, [html]);

  useEffect(() => {
    if (iframeRef.current && viewMode === 'preview') {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(localHtml);
        doc.close();
      }
    }
  }, [localHtml, viewMode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(localHtml);
    // You could add a toast notification here
  };

  const handleDownload = () => {
    const blob = new Blob([localHtml], { type: 'text/html' });
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
    const blob = new Blob([localHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 rounded flex items-center space-x-1 transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm">Preview</span>
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-3 py-1 rounded flex items-center space-x-1 transition-colors ${
                  viewMode === 'code'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Code className="w-4 h-4" />
                <span className="text-sm">Code</span>
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleCopy}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Copy HTML"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Download HTML"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleOpenInNewTab}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'preview' ? (
            <iframe
              ref={iframeRef}
              className="w-full h-full bg-white"
              title="HTML Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="h-full bg-gray-950 p-4 overflow-auto">
              <pre className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
                <code>{localHtml}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};