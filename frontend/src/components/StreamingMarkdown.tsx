import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
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

    // Simple approach: Just render markdown as-is and let react-markdown handle it
    // This preserves streaming while still providing formatting
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
      const inline = !className?.startsWith('language-');

      if (!inline) {
        const currentIndex = codeBlockIndex++;
        const codeString = String(children).replace(/\n$/, '');

        return (
          <div className="relative mb-4 group">
            <div className="absolute top-0 right-0 flex items-center gap-2">
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
