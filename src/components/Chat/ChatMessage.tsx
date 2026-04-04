import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage as Msg } from '@/types/chat';
import { CommandButton } from './CommandButton';
import { cn } from '@/lib/utils';

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex animate-in fade-in-0 slide-in-from-bottom-2 flex-col gap-1.5 duration-200', {
        'items-end': isUser,
        'items-start': !isUser,
      })}
    >
      <div className="flex max-w-[95%] flex-col gap-1.5">
        <div className="flex items-center gap-1.5 px-0.5">
          <div
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold',
              isUser
                ? 'border border-terminalai-borderBright bg-terminalai-overlay text-terminalai-muted'
                : 'bg-gradient-to-br from-terminalai-accent to-[#c084fc] text-white'
            )}
            aria-hidden
          >
            {isUser ? 'U' : 'AI'}
          </div>
          <span className="text-[11px] font-semibold text-terminalai-muted">
            {isUser ? 'You' : 'Assistant'}
          </span>
        </div>
        <div
          className={cn(
            'rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed text-terminalai-text',
            'rounded-bl-sm',
            isUser
              ? 'border-terminalai-borderBright bg-terminalai-overlay'
              : 'border-terminalai-border bg-terminalai-elevated'
          )}
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
                      <code className="rounded bg-terminalai-hover px-1.5 py-0.5 font-mono text-[11px] text-terminalai-cyan">
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
                    <div className="relative my-2 rounded-lg border border-terminalai-border bg-terminalai-base">
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
    </div>
  );
}
