import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface StreamingMarkdownProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({ 
  content, 
  isStreaming = false,
  className = '' 
}) => {
  // Simple approach: Just render markdown as-is and let react-markdown handle it
  // This preserves streaming while still providing formatting
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && <span className="animate-pulse ml-1">▊</span>}
    </div>
  );
};

// Markdown component customizations
const markdownComponents = {
  h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
  p: ({ children }: any) => <p className="mb-4 leading-relaxed">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc list-inside mb-4 ml-4">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal list-inside mb-4 ml-4">{children}</ol>,
  li: ({ children }: any) => <li className="mb-1">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 py-2 mb-4 italic text-gray-700">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const inline = !className?.startsWith('language-');
    return !inline ? (
      <div className="relative mb-4">
        {match && (
          <div className="absolute top-0 right-0 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-bl">
            {match[1]}
          </div>
        )}
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    ) : (
      <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm" {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }: any) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full border-collapse border border-gray-300">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-gray-100">{children}</thead>,
  tbody: ({ children }: any) => <tbody>{children}</tbody>,
  tr: ({ children }: any) => <tr className="border-b border-gray-300">{children}</tr>,
  th: ({ children }: any) => (
    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }: any) => <td className="border border-gray-300 px-4 py-2">{children}</td>,
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-gray-300" />,
  img: ({ src, alt }: any) => (
    <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-4" />
  ),
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
};