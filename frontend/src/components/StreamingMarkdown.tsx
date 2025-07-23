import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { PermissionCard } from './PermissionCard';
import 'highlight.js/styles/github.css';

interface StreamingMarkdownProps {
  content: string;
  isStreaming?: boolean;
  mcpAutoApprove?: boolean;
  className?: string;
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = React.memo(
  ({ content, isStreaming = false, mcpAutoApprove = false, className = '' }) => {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [showReferences, setShowReferences] = useState(false);
    const [expandedCanvas, setExpandedCanvas] = useState<number | null>(null);

    const handleCopyCode = (code: string, index: number) => {
      navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    };

    // Pre-process content to fix formatting issues
    const preprocessContent = (text: string): string => {
      // Fix multi-line span tags for citations
      text = text.replace(
        /<span\s+class="citation-inline"[^>]*>[\s\S]*?\[(\d+)\][\s\S]*?<\/span\s*>/g,
        (match) => {
          // Extract the citation number and attributes
          const numberMatch = match.match(/\[(\d+)\]/);
          const titleMatch = match.match(/title="([^"]*?)"/);
          const dataSourceMatch = match.match(/data-source="([^"]*?)"/);

          if (numberMatch) {
            const number = numberMatch[1];
            const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';
            const dataSource = dataSourceMatch ? dataSourceMatch[1] : number;

            // Return a properly formatted single-line span
            return `<span class="citation-inline" title="${title}" data-source="${dataSource}">[${number}]</span>`;
          }

          return match;
        }
      );

      // Fix search details that have multiple list items on one line
      // Look for patterns like ":** - Query: ... - Results: ... - Quality:"
      text = text.replace(
        /(\*\*[^:]+:\*\*)\s*-\s*([^-]+(?:-(?![A-Z][a-z]+:)[^-]+)*)/g,
        (match, prefix, content) => {
          // Split by " - " where the dash is followed by a capitalized word and colon
          const items = content.split(/\s+-\s+(?=[A-Z])/);
          if (items.length > 1) {
            // Convert to proper markdown list
            return prefix + '\n' + items.map((item: string) => '- ' + item.trim()).join('\n');
          }
          return match;
        }
      );

      // Handle ```html blocks - if content starts with ```html, replace the entire block
      if (text.trim().startsWith('```html')) {
        // Replace the entire ```html block with waiting message
        text = text.replace(/^```html[\s\S]*?(?:```|$)/m, '_AI is responding, please wait..._');
      } else {
        // Replace any ```html blocks that appear later in the content
        text = text.replace(/```html\n([\s\S]*?)(?:\n```|$)/g, '_AI is responding, please wait..._');
      }

      // Convert literal \n to actual newlines
      text = text.replace(/\\n/g, '\n');

      return text;
    };

    // Apply preprocessing to content (this will replace ```html blocks with waiting message)
    content = preprocessContent(content);

    // Check if content contains permission request
    const permissionRegex =
      /\[MCP_PERMISSION_REQUEST\]\s*TOOL:\s*(.+?)\s*DESCRIPTION:\s*(.+?)\s*PURPOSE:\s*(.+?)\s*\[\/MCP_PERMISSION_REQUEST\]/s;
    const permissionMatch = content.match(permissionRegex);

    // Check if content contains RAG references
    // Look for --- References --- or --- Reference --- anywhere in the content
    const referencesIndex = content.search(/--- References? ---/i);
    let referencesMatch = null;
    
    if (referencesIndex !== -1) {
      // Extract everything after the references marker
      const afterReferences = content.substring(referencesIndex);
      const match = afterReferences.match(/--- References? ---(.*)$/is);
      if (match) {
        referencesMatch = [match[0], match[1]];
      }
    }

    // Check if content contains canvas mode blocks
    const canvasRegex = /\[canvas mode\]([\s\S]*?)\[\/canvas mode\]/g;
    const processedContent = content.replace(canvasRegex, (_match, htmlContent, offset) => {
      const canvasId = `canvas-${offset}`;
      return `<div data-canvas-id="${canvasId}" data-canvas-html="${encodeURIComponent(htmlContent.trim())}"></div>`;
    });

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
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={markdownComponents(
                handleCopyCode,
                copiedIndex,
                expandedCanvas,
                setExpandedCanvas
              )}
            >
              {beforePermission}
            </ReactMarkdown>
          )}
          <PermissionCard
            toolName={tool.trim()}
            description={description.trim()}
            purpose={purpose.trim()}
            mcpAutoApprove={mcpAutoApprove}
          />
          {afterPermission && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
              components={markdownComponents(
                handleCopyCode,
                copiedIndex,
                expandedCanvas,
                setExpandedCanvas
              )}
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
      const [, referencesText] = referencesMatch;
      const mainContent = content.substring(0, referencesIndex);
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
            rehypePlugins={[rehypeRaw, rehypeHighlight]}
            components={markdownComponents(
              handleCopyCode,
              copiedIndex,
              expandedCanvas,
              setExpandedCanvas
            )}
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
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={markdownComponents(
            handleCopyCode,
            copiedIndex,
            expandedCanvas,
            setExpandedCanvas
          )}
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
  copiedIndex: number | null,
  expandedCanvas?: number | null,
  setExpandedCanvas?: (id: number | null) => void
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
    div: ({ node: _node, ...props }: any) => {
      // Check if this is a canvas block
      const canvasId = props['data-canvas-id'];
      const canvasHtml = props['data-canvas-html'];

      if (canvasId && canvasHtml) {
        const decodedHtml = decodeURIComponent(canvasHtml);
        const canvasIndex = parseInt(canvasId.split('-')[1]);
        const isExpanded = expandedCanvas === canvasIndex;

        return (
          <div className="my-4">
            <div
              className="relative bg-gradient-to-r from-purple-500 to-pink-500 p-[2px] rounded-lg cursor-pointer transform transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
              onClick={() => setExpandedCanvas?.(isExpanded ? null : canvasIndex)}
            >
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Canvas Preview</h3>
                      <p className="text-sm text-gray-500">
                        Click to {isExpanded ? 'collapse' : 'expand'} HTML preview
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t pt-4">
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                        {decodedHtml}
                      </pre>
                    </div>
                    <button
                      className="mt-3 w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Dispatch custom event to open canvas
                        const event = new CustomEvent('open-canvas', {
                          detail: { html: decodedHtml, title: 'Canvas Preview' },
                        });
                        window.dispatchEvent(event);
                      }}
                    >
                      Open in Canvas
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      return <div {...props} />;
    },
  };
};
