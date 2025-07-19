import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github.css';

interface StreamingMarkdownProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = React.memo(
  ({ content, isStreaming = false, className = '' }) => {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleCopyCode = (code: string, index: number) => {
      navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    };

    // Process content to convert permission requests to HTML
    const processContent = (text: string): string => {
      const permissionRegex = /\[MCP_PERMISSION_REQUEST\]\s*TOOL:\s*(.+?)\s*DESCRIPTION:\s*(.+?)\s*PURPOSE:\s*(.+?)\s*\[\/MCP_PERMISSION_REQUEST\]/gs;
      
      return text.replace(permissionRegex, (_match, tool, description, purpose) => {
        const htmlCard = `
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.2); margin: 16px 0;">
  <div style="display: flex; align-items: center; margin-bottom: 16px;">
    <div style="background: rgba(255,255,255,0.2); border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; margin-right: 16px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7V12C2 16.55 4.84 20.74 9 22.05V19.77C6.2 18.63 4.5 15.58 4.5 12V8.3L12 4.65L19.5 8.3V12C19.5 12.63 19.38 13.23 19.2 13.79L21.26 15.85C21.73 14.64 22 13.34 22 12V7L12 2M18 14C17.87 14 17.76 14.09 17.74 14.21L17.55 15.53C17.25 15.66 16.96 15.82 16.7 16L15.46 15.5C15.35 15.5 15.22 15.5 15.15 15.63L14.15 17.36C14.09 17.47 14.11 17.6 14.21 17.68L15.27 18.5C15.25 18.67 15.24 18.83 15.24 19C15.24 19.17 15.25 19.33 15.27 19.5L14.21 20.32C14.12 20.4 14.09 20.53 14.15 20.64L15.15 22.37C15.21 22.5 15.34 22.5 15.46 22.5L16.7 22C16.96 22.18 17.24 22.35 17.55 22.47L17.74 23.79C17.76 23.91 17.86 24 18 24H20C20.11 24 20.22 23.91 20.25 23.79L20.44 22.47C20.74 22.34 21 22.18 21.27 22L22.5 22.5C22.61 22.5 22.74 22.5 22.81 22.37L23.81 20.64C23.87 20.53 23.85 20.4 23.75 20.32L22.69 19.5C22.71 19.33 22.72 19.17 22.72 19C22.72 18.83 22.71 18.67 22.69 18.5L23.75 17.68C23.84 17.6 23.87 17.47 23.81 17.36L22.81 15.63C22.75 15.5 22.62 15.5 22.5 15.5L21.27 16C21 15.82 20.75 15.66 20.44 15.53L20.25 14.21C20.22 14.09 20.11 14 20 14H18M19 17.5C19.83 17.5 20.5 18.17 20.5 19C20.5 19.83 19.83 20.5 19 20.5C18.16 20.5 17.5 19.83 17.5 19C17.5 18.17 18.17 17.5 19 17.5Z" fill="currentColor"/>
      </svg>
    </div>
    <h3 style="margin: 0; font-size: 24px; font-weight: 600;">MCP Tool Request</h3>
  </div>
  
  <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
    <p style="margin: 0 0 8px 0; opacity: 0.9; font-size: 14px;">I'd like to use the following tool:</p>
    <p style="margin: 0; font-size: 18px; font-weight: 500;">🔧 ${tool.trim()}</p>
    <p style="margin: 8px 0 0 0; opacity: 0.8; font-size: 14px;">${description.trim()}</p>
  </div>
  
  <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0 0 8px 0; font-weight: 500; font-size: 16px;">Purpose:</p>
    <p style="margin: 0; opacity: 0.9; line-height: 1.5;">${purpose.trim()}</p>
  </div>
  
  <div style="display: flex; gap: 12px; justify-content: center; padding: 16px 0;">
    <button 
      onclick="window.dispatchEvent(new CustomEvent('mcp-permission', { detail: 'cancel' }))"
      style="background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 12px 24px; font-weight: 500; cursor: pointer; transition: all 0.2s; color: white; font-size: 16px;"
      onmouseover="this.style.background='rgba(255,255,255,0.3)'"
      onmouseout="this.style.background='rgba(255,255,255,0.2)'"
    >
      ❌ Cancel
    </button>
    <button 
      onclick="window.dispatchEvent(new CustomEvent('mcp-permission', { detail: 'approve' }))"
      style="background: rgba(255,255,255,0.9); color: #667eea; border: none; border-radius: 8px; padding: 12px 24px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 16px;"
      onmouseover="this.style.background='rgba(255,255,255,1)'"
      onmouseout="this.style.background='rgba(255,255,255,0.9)'"
    >
      ✅ Approve
    </button>
  </div>
</div>`;
        return htmlCard;
      });
    };

    const processedContent = processContent(content);

    // Simple approach: Just render markdown as-is and let react-markdown handle it
    // This preserves streaming while still providing formatting
    return (
      <div className={`markdown-content ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={markdownComponents(handleCopyCode, copiedIndex)}
        >
          {processedContent}
        </ReactMarkdown>
        {isStreaming && <span className="animate-pulse ml-1 text-black">▊</span>}
      </div>
    );
  }
);

// Track code block index
let codeBlockIndex = 0;

// Markdown component customizations
const markdownComponents = (
  handleCopyCode: (code: string, index: number) => void,
  copiedIndex: number | null
) => {
  // Reset index on each render
  codeBlockIndex = 0;

  return {
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold mb-4 mt-6 text-black">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-bold mb-3 mt-5 text-black">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-bold mb-2 mt-4 text-black">{children}</h3>
    ),
    p: ({ children }: any) => <p className="mb-4 leading-relaxed text-black">{children}</p>,
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside mb-4 ml-4 text-black">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside mb-4 ml-4 text-black">{children}</ol>
    ),
    li: ({ children }: any) => <li className="mb-1 text-black">{children}</li>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-black pl-4 py-2 mb-4 italic text-black">
        {children}
      </blockquote>
    ),
    code: ({ className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      // ReactMarkdown passes inline prop to distinguish code blocks from inline code
      const isInlineCode = props.inline === true;

      if (!isInlineCode) {
        const currentIndex = codeBlockIndex++;

        // Extract text content from children (handles both string and React elements)
        const extractText = (node: any): string => {
          if (typeof node === 'string') return node;
          if (Array.isArray(node)) return node.map(extractText).join('');
          if (node?.props?.children) return extractText(node.props.children);
          return '';
        };

        const codeString = extractText(children).replace(/\n$/, '');

        return (
          <div className="relative mb-4 group">
            <div className="absolute top-0 right-0 flex items-center gap-2 z-10">
              {match && (
                <div className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded-bl">
                  {match[1]}
                </div>
              )}
              <button
                onClick={() => handleCopyCode(codeString, currentIndex)}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded-bl transition-colors"
                title="Copy code"
              >
                {copiedIndex === currentIndex ? (
                  <span className="text-green-600">Copied!</span>
                ) : (
                  <span className="text-gray-700">Copy</span>
                )}
              </button>
            </div>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }

      return (
        <code className="bg-gray-100 text-black px-1 py-0.5 rounded text-sm" {...props}>
          {children}
        </code>
      );
    },
    table: ({ children }: any) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full border-collapse border border-black">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-gray-100 text-black">{children}</thead>,
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => <tr className="border-b border-black">{children}</tr>,
    th: ({ children }: any) => (
      <th className="border border-black px-4 py-2 text-left font-semibold text-black">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border border-black px-4 py-2 text-black">{children}</td>
    ),
    a: ({ href, children }: any) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-black hover:text-black underline"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="my-6 border-black" />,
    img: ({ src, alt }: any) => (
      <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-4" />
    ),
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }: any) => <em className="italic">{children}</em>,
  };
};
