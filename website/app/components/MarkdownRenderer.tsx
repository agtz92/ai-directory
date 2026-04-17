import { type ReactNode } from 'react'

type Props = { content: string; className?: string }

export default function MarkdownRenderer({ content, className = '' }: Props) {
  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      const blockStart = i
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      i++
      elements.push(
        <pre key={`code-${blockStart}`} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 overflow-x-auto text-sm font-mono my-4">
          <code>{codeLines.join('\n')}</code>
        </pre>
      )
      continue
    }

    // Headings
    const h3 = line.match(/^###\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h1 = line.match(/^#\s+(.+)/)
    if (h3) { elements.push(<h3 key={`h3-${i}`} className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-6 mb-2">{ir(h3[1])}</h3>); i++; continue }
    if (h2) { elements.push(<h2 key={`h2-${i}`} className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-8 mb-3">{ir(h2[1])}</h2>); i++; continue }
    if (h1) { elements.push(<h1 key={`h1-${i}`} className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-8 mb-4">{ir(h1[1])}</h1>); i++; continue }

    // HR
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={`hr-${i}`} className="my-6 border-slate-200 dark:border-slate-700" />); i++; continue
    }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      const s = i
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, '')); i++ }
      elements.push(
        <ul key={`ul-${s}`} className="list-disc list-inside space-y-1 my-3 text-slate-700 dark:text-slate-300">
          {items.map((it, j) => <li key={j}>{ir(it)}</li>)}
        </ul>
      )
      continue
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      const s = i
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, '')); i++ }
      elements.push(
        <ol key={`ol-${s}`} className="list-decimal list-inside space-y-1 my-3 text-slate-700 dark:text-slate-300">
          {items.map((it, j) => <li key={j}>{ir(it)}</li>)}
        </ol>
      )
      continue
    }

    // Paragraph
    const paraLines: string[] = []
    const ps = i
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !lines[i].startsWith('```')
    ) { paraLines.push(lines[i]); i++ }
    if (paraLines.length) {
      elements.push(
        <p key={`p-${ps}`} className="text-slate-600 dark:text-slate-300 leading-relaxed my-3">
          {ir(paraLines.join(' '))}
        </p>
      )
    }
  }

  return <div className={className}>{elements}</div>
}

function ir(text: string): ReactNode {
  const parts: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g
  let last = 0, match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    if (match[1]) parts.push(<strong key={match.index} className="font-semibold text-slate-900 dark:text-slate-100">{match[1]}</strong>)
    else if (match[2]) parts.push(<em key={match.index}>{match[2]}</em>)
    else if (match[3]) parts.push(<code key={match.index} className="bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded text-sm font-mono">{match[3]}</code>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
