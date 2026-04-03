import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage as Msg } from '@/types/chat';
import { CommandButton } from './CommandButton';

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} text-sm`}
      style={{ fontSize: 14 }}
    >
      <div
        className={`max-w-[95%] rounded-lg px-3 py-2 ${
          isUser ? 'bg-terminalai-accent/25 text-terminalai-text' : 'bg-terminalai-bg text-terminalai-text'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown
            components={{
              code({ className, children }) {
                const text = String(children).replace(/\n$/, '');
                const match = /language-(\w+)/.exec(className || '');
                const lang = match?.[1] ?? '';
                const block = Boolean(className?.includes('language-'));
                if (!block) {
                  return (
                    <code className="rounded bg-terminalai-terminal px-1 font-mono text-[13px] text-terminalai-accent">
                      {text}
                    </code>
                  );
                }
                const shellish = ['bash', 'sh', 'shell', 'zsh', 'fish'].includes(lang);
                const first = text.split('\n')[0]?.trim() ?? text;
                let html = text;
                try {
                  const l = hljs.getLanguage(lang) ? lang : 'bash';
                  html = hljs.highlight(text, { language: l }).value;
                } catch {
                  html = hljs.highlightAuto(text).value;
                }
                return (
                  <div className="relative my-2 rounded border border-terminalai-border bg-terminalai-terminal">
                    {shellish && <CommandButton command={first} />}
                    <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed">
                      <code dangerouslySetInnerHTML={{ __html: html }} />
                    </pre>
                  </div>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
