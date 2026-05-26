import React from "react";

interface Props {
  markdown: string;
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <a
          key={key++}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline break-all"
        >
          {m[1]}
        </a>
      );
    } else if (m[3]) {
      out.push(
        <strong key={key++} className="font-semibold text-gray-900">
          {m[3]}
        </strong>
      );
    } else if (m[4]) {
      out.push(
        <code
          key={key++}
          className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono"
        >
          {m[4]}
        </code>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownView({ markdown }: Props) {
  if (!markdown || !markdown.trim()) {
    return <p className="text-sm text-gray-400">本文がありません</p>;
  }

  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^# /.test(line)) {
      elements.push(
        <h1 key={key++} className="text-lg font-bold text-gray-900 mt-1 mb-3 break-words">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }
    if (/^## /.test(line)) {
      elements.push(
        <h2
          key={key++}
          className="text-base font-bold text-gray-900 mt-5 mb-2 pt-3 border-t border-gray-100 break-words"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }
    if (/^### /.test(line)) {
      elements.push(
        <h3 key={key++} className="text-sm font-semibold text-gray-700 mt-3 mb-1 break-words">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      elements.push(
        <ul
          key={key++}
          className="list-disc pl-5 space-y-1 my-2 text-sm text-gray-700"
        >
          {items.map((it, idx) => (
            <li key={idx} className="leading-relaxed break-words">
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol
          key={key++}
          className="list-decimal pl-5 space-y-1 my-2 text-sm text-gray-700"
        >
          {items.map((it, idx) => (
            <li key={idx} className="leading-relaxed break-words">
              {renderInline(it)}
            </li>
          ))}
        </ol>
      );
      continue;
    }
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <pre
          key={key++}
          className="bg-slate-900 text-slate-100 text-xs rounded-xl p-3 overflow-x-auto my-3"
        >
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }
    if (/^> /.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^> /.test(lines[i])) {
        quote.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={key++}
          className="border-l-4 border-slate-300 pl-3 my-2 text-sm text-gray-600 italic"
        >
          {quote.map((q, idx) => (
            <p key={idx} className="break-words">{renderInline(q)}</p>
          ))}
        </blockquote>
      );
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^>\s/.test(lines[i]) &&
      !/^```/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    elements.push(
      <p key={key++} className="text-sm text-gray-700 leading-relaxed my-2 break-words">
        {renderInline(paragraph.join(" "))}
      </p>
    );
  }

  return <div>{elements}</div>;
}
