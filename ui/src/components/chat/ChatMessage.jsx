import SakuraLogo from '../SakuraLogo';

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

/**
 * Render plain text with newlines → <br> and basic code fencing.
 * No external markdown library needed.
 */
function RenderContent({ text }) {
  if (!text) return <TypingDots />;

  const lines = text.split('\n');
  const elements = [];
  let inCode = false;
  let codeLines = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <pre key={key++} className="bg-[#1a1a2e] text-[#e8eaf6] text-xs p-3 rounded-xl overflow-x-auto my-2">
            <code>{codeLines.join('\n')}</code>
          </pre>,
        );
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (line.trim() === '') {
      elements.push(<br key={key++} />);
    } else {
      elements.push(<p key={key++} className="leading-relaxed">{line}</p>);
    }
  }

  if (inCode && codeLines.length) {
    elements.push(
      <pre key={key++} className="bg-[#1a1a2e] text-[#e8eaf6] text-xs p-3 rounded-xl overflow-x-auto my-2">
        <code>{codeLines.join('\n')}</code>
      </pre>,
    );
  }

  return <div className="prose-answer flex flex-col gap-0.5">{elements}</div>;
}

export default function ChatMessage({ message, isStreaming }) {
  const { content, isUser } = message;

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div
          className="max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-3
                     bg-gradient-to-br from-sakura-300 to-sakura-400
                     text-white text-sm leading-relaxed shadow-sakura"
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* Avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-sakura-50 border border-sakura-200 flex items-center justify-center mt-0.5 shadow-sakura">
        <SakuraLogo size={16} />
      </div>

      {/* Bubble */}
      <div
        className="max-w-[72%] rounded-2xl rounded-tl-sm px-4 py-3
                   bg-white border border-gray-100 shadow-message
                   text-sm text-gray-800"
      >
        {isStreaming && !content ? (
          <TypingDots />
        ) : (
          <RenderContent text={content} />
        )}
      </div>
    </div>
  );
}
