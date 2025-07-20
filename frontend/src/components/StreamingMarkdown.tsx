import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { PermissionCard } from './PermissionCard';
import 'highlight.js/styles/github.css';

interface StreamingMarkdownProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = React.memo(
  ({ content, isStreaming = false, className = '' }) => {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [showReferences, setShowReferences] = useState(false);

    const handleCopyCode = (code: string, index: number) => {
      navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    };

    // Check if content contains permission request
    const permissionRegex =
      /\[MCP_PERMISSION_REQUEST\]\s*TOOL:\s*(.+?)\s*DESCRIPTION:\s*(.+?)\s*PURPOSE:\s*(.+?)\s*\[\/MCP_PERMISSION_REQUEST\]/s;
    const permissionMatch = content.match(permissionRegex);

    // Check if content contains RAG references
    const referencesRegex = /\n\n--- References ---\n(.+?)$/s;
    const referencesMatch = content.match(referencesRegex);

    if (permissionMatch) {
      // Extract permission request details
      const [fullMatch, tool, description, purpose] = permissionMatch;
      const beforePermission = content.substring(0, content.indexOf(fullMatch));
      const afterPermission = content.substring(content.indexOf(fullMatch) + fullMatch.length);

      return (
        <div className={`markdown-content ${className}`}>
          {beforePermission && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents(handleCopyCode, copiedIndex)}
            >
              {beforePermission}
            </ReactMarkdown>
          )}
          <PermissionCard
            toolName={tool.trim()}
            description={description.trim()}
            purpose={purpose.trim()}
          />
          {afterPermission && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents(handleCopyCode, copiedIndex)}
            >
              {afterPermission}
            </ReactMarkdown>
          )}
          {isStreaming && <span className="animate-pulse ml-1 text-black">▊</span>}
        </div>
      );
    }

    // Handle content with or without references
    if (referencesMatch) {
      const [fullMatch, referencesText] = referencesMatch;
      const mainContent = content.substring(0, content.indexOf(fullMatch));
      // Parse references to extract citation, title, page, and preview
      const references = referencesText
        .trim()
        .split('\n\n')
        .filter((ref) => ref.trim())
        .map((ref) => {
          const lines = ref.split('\n');
          const mainLine = lines[0];
          const previewLine = lines.find((line) => line.trim().startsWith('"'));

          // Extract citation number, title, page info, and similarity
          const citationMatch = mainLine.match(
            /^\[(\d+)\] (.+?)(?:\s+\(Page?\s+([^)]+)\))?\s+-\s+Similarity:\s+(\d+\.?\d*)%$/
          );

          if (citationMatch) {
            const [, citationNumber, title, pageInfo, similarity] = citationMatch;
            return {
              citationNumber: parseInt(citationNumber),
              title: title.trim(),
              pageInfo: pageInfo || null,
              similarity: parseFloat(similarity),
              preview: previewLine ? previewLine.trim().replace(/^"/, '').replace(/"$/, '') : null,
            };
          }

          // Fallback for simple format
          return {
            citationNumber: 0,
            title: mainLine,
            pageInfo: null,
            similarity: 0,
            preview: previewLine ? previewLine.trim().replace(/^"/, '').replace(/"$/, '') : null,
          };
        });

      return (
        <div className={`markdown-content ${className}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={markdownComponents(handleCopyCode, copiedIndex)}
          >
            {mainContent}
          </ReactMarkdown>

          {/* Subtle references indicator */}
          <div className="mt-3 border-t border-gray-200 pt-3">
            <button
              onClick={() => setShowReferences(!showReferences)}
              className="flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors duration-200"
            >
              <svg
                className={`w-3 h-3 mr-1 transform transition-transform duration-200 ${showReferences ? 'rotate-90' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {references.length} source{references.length !== 1 ? 's' : ''} used
            </button>

            {/* Collapsible references */}
            {showReferences && (
              <div className="mt-2 space-y-2 animate-fadeIn">
                {references.map((ref, index) => (
                  <div
                    key={index}
                    className="group relative pl-6 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors duration-200"
                  >
                    {/* Citation number */}
                    <span className="absolute left-0 top-2 w-4 h-4 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-[10px] font-medium">
                      {ref.citationNumber || index + 1}
                    </span>

                    {/* Document info */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-700">{ref.title}</div>
                        {ref.pageInfo && (
                          <span className="text-gray-500">
                            {ref.pageInfo.includes('-') ? 'Pages' : 'Page'} {ref.pageInfo}
                          </span>
                        )}
                      </div>
                      {ref.similarity > 0 && (
                        <span className="text-[10px] text-gray-400 ml-2">
                          {ref.similarity.toFixed(0)}%
                        </span>
                      )}
                    </div>

                    {/* Preview on hover */}
                    {ref.preview && (
                      <div className="mt-1 text-gray-500 italic line-clamp-2 group-hover:line-clamp-none transition-all duration-200">
                        "{ref.preview}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isStreaming && <span className="animate-pulse ml-1 text-black">▊</span>}
        </div>
      );
    }

    // No special content, render normally
    return (
      <div className={`markdown-content ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents(handleCopyCode, copiedIndex)}
        >
          {content}
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
