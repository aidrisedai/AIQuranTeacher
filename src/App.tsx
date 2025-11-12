import { useState } from 'react'
import ChatInterface from './components/ChatInterface'
import BlackboardExcalidraw from './components/BlackboardExcalidraw'
import './App.css'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export type Stroke = { points: { x: number; y: number }[]; color?: string; width?: number }

export type BoardAction =
  | { type: 'write_text'; text: string; rtl?: boolean; size?: number; color?: string; x?: number; y?: number }
  | { type: 'draw_shape'; shape: 'circle' | 'rect' | 'line' | 'arrow'; points?: { x: number; y: number }[]; color?: string; width?: number }
  | { type: 'annotate_text'; note: string; color?: string }
  | { type: 'freehand_request'; instruction: string; color?: string; width?: number; style?: 'chalk' | 'marker' }
  | { type: 'freehand_strokes'; strokes: Stroke[] }

// Simple local fallback parser for common commands if the planner returns nothing
function parseLocalActions(message: string): BoardAction[] {
  const m = message.trim()
  const lower = m.toLowerCase()

  const pickColor = (): string | undefined => {
    if (lower.includes(' red')) return '#ef4444'
    if (lower.includes(' yellow')) return '#fde047'
    if (lower.includes(' green')) return '#22c55e'
    if (lower.includes(' blue')) return '#60a5fa'
    if (lower.includes(' white')) return '#fafafa'
    return undefined
  }
  const color = pickColor()

  const size = lower.includes('large') ? 28 : lower.includes('small') ? 18 : lower.includes('medium') ? 22 : undefined

  // Detect quoted text
  const quoted = m.match(/["“](.+?)["”]/)
  const arabicRegex = /[\u0600-\u06FF]/

  // Write cases
  if (lower.startsWith('write') || lower.startsWith('please write') || lower.includes('write:')) {
    let text = quoted?.[1] ?? m.replace(/^[Ww]rite:?\s*/, '')
    if (!text) text = m
    const rtl = arabicRegex.test(text)
    return [{ type: 'write_text', text, rtl, size, color }]
  }

  // Draw shapes
  if (lower.includes('draw a circle') || lower.includes('draw circle')) {
    return [{ type: 'draw_shape', shape: 'circle', color, width: 4 }]
  }
  if (lower.includes('draw an arrow') || lower.includes('draw arrow')) {
    return [{ type: 'draw_shape', shape: 'arrow', color, width: 4 }]
  }
  if (lower.includes('draw a rectangle') || lower.includes('draw rectangle') || lower.includes('draw a box') || lower.includes('draw box')) {
    return [{ type: 'draw_shape', shape: 'rect', color, width: 4 }]
  }
  if (lower.includes('draw a line') || lower.includes('draw line')) {
    return [{ type: 'draw_shape', shape: 'line', color, width: 4 }]
  }

  // General draw request → freehand_request
  if (lower.startsWith('draw')) {
    const instruction = m.replace(/^[Dd]raw\s*/, '') || m
    return [{ type: 'freehand_request', instruction, color, width: 4, style: 'chalk' }]
  }

  // Fallback: if there is quoted content, write it
  if (quoted?.[1]) {
    const text = quoted[1]
    const rtl = arabicRegex.test(text)
    return [{ type: 'write_text', text, rtl, size, color }]
  }
  return []
}

// Option A: compact string commands mapped directly to a single board action
function parseSimpleCommandA(message: string): BoardAction | null {
  const s = message.trim()
  // Helper to get param value e.g., color=red -> 'red'
  const get = (k: string): string | undefined => {
    const m = s.match(new RegExp(`${k}=("[^"]+"|[^\s]+)`, 'i'))
    if (!m) return undefined
    return m[1]?.replace(/^"|"$/g, '')
  }
  const num = (k: string): number | undefined => {
    const v = get(k)
    if (v == null) return undefined
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }

  // write "text" ...
  if (/^write\b/i.test(s)) {
    const q = s.match(/"([\s\S]+?)"/)
    const text = q?.[1] || s.replace(/^write\s*/i, '')
    const color = get('color')
    const size = num('size')
    const x = num('x')
    const y = num('y')
    const rtl = /[\u0600-\u06FF]/.test(text)
    return { type: 'write_text', text, rtl, size, color, x, y }
  }

  // arrow
  if (/^arrow\b/i.test(s)) {
    const x1 = num('x1') ?? 100
    const y1 = num('y1') ?? 100
    const x2 = num('x2') ?? 260
    const y2 = num('y2') ?? 100
    const color = get('color')
    const width = num('width')
    return { type: 'draw_shape', shape: 'arrow', points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], color, width }
  }

  // line
  if (/^line\b/i.test(s)) {
    const x1 = num('x1') ?? 100
    const y1 = num('y1') ?? 100
    const x2 = num('x2') ?? 260
    const y2 = num('y2') ?? 100
    const color = get('color')
    const width = num('width')
    return { type: 'draw_shape', shape: 'line', points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], color, width }
  }

  // circle
  if (/^circle\b/i.test(s)) {
    const cx = num('cx') ?? 240
    const cy = num('cy') ?? 180
    const r = num('r') ?? 60
    const color = get('color')
    const width = num('width')
    return { type: 'draw_shape', shape: 'circle', points: [{ x: cx, y: cy }, { x: r, y: r }], color, width }
  }

  // rect
  if (/^(rect|rectangle)\b/i.test(s)) {
    const x = num('x') ?? 100
    const y = num('y') ?? 120
    const w = num('w') ?? 200
    const h = num('h') ?? 120
    const color = get('color')
    const width = num('width')
    return { type: 'draw_shape', shape: 'rect', points: [{ x, y }, { x: w, y: h }], color, width }
  }

  return null
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome to the AI Quran Teacher Classroom! Ask me anything about the Quran, and I\'ll write the answers on the blackboard.',
      timestamp: new Date()
    }
  ])
  const [boardActions, setBoardActions] = useState<BoardAction[]>([])
  const [followCommands] = useState<boolean>(true)

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])

    // Fast path: simple command Option A -> draw immediately (no network)
    const direct = parseSimpleCommandA(content)
    if (direct) {
      setBoardActions(prev => [...prev, direct])
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Drawing on the board.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
      return
    }

    // If the user said "draw ..." and it isn't a simple Option A command, use the drawing agent directly
    if (/^draw\b/i.test(content)) {
      fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: content.replace(/^draw\s*/i, ''), style: 'chalk' })
      })
        .then(async (res) => {
          if (!res.ok) {
            const t = await res.text().catch(() => '')
            throw new Error(t || `HTTP ${res.status}`)
          }
          return res.json() as Promise<{ strokes: Stroke[] }>
        })
        .then(({ strokes }) => {
          setBoardActions(prev => [...prev, { type: 'freehand_strokes', strokes }])
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Drawing on the board.',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, assistantMessage])
        })
        .catch((err) => {
          const assistantMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: `Sorry, I couldn't draw that. (${err.message})`,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, assistantMessage])
        })
      return
    }

    // Call backend APIs in parallel: chat reply and board plan
    const chatPromise = fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content })
    })
      .then(async (res) => {
        if (!res.ok) {
          const t = await res.text().catch(() => '')
          throw new Error(t || `HTTP ${res.status}`)
        }
        return res.json() as Promise<{ reply: string }>
      })

    const planPromise = fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: content })
    })
      .then(async (res) => {
        if (!res.ok) {
          const t = await res.text().catch(() => '')
          throw new Error(t || `HTTP ${res.status}`)
        }
        return res.json() as Promise<{ actions: BoardAction[] }>
      })

    Promise.allSettled([chatPromise, planPromise]).then(async (results) => {
      const [chatRes, planRes] = results as [PromiseSettledResult<{ reply: string }>, PromiseSettledResult<{ actions: BoardAction[] }>]

      if (chatRes.status === 'fulfilled') {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: chatRes.value.reply,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        const assistantMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `Sorry, I couldn't get a response right now. (${chatRes.reason?.message || chatRes.reason})`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      }

      let planned: BoardAction[] = []
      if (planRes.status === 'fulfilled') planned = planRes.value.actions || []

      if (followCommands) {
        // If planner returned nothing, try local fallback parser
        if (!planned || planned.length === 0) {
          planned = parseLocalActions(content)
        }
        if (planned && planned.length > 0) {
          // Resolve any freehand_request actions via /api/draw
          const freehandReqs = planned.filter(a => a.type === 'freehand_request') as Extract<BoardAction, { type: 'freehand_request' }>[]
          const others = planned.filter(a => a.type !== 'freehand_request')

          const strokeResults = await Promise.allSettled(
            freehandReqs.map(req =>
              fetch('/api/draw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instruction: req.instruction, color: req.color, width: req.width, style: req.style || 'chalk' })
              }).then(async (res) => {
                if (!res.ok) {
                  const t = await res.text().catch(() => '')
                  throw new Error(t || `HTTP ${res.status}`)
                }
                return res.json() as Promise<{ strokes: import('./App').Stroke[] }>
              })
            )
          )

          const strokeActions: BoardAction[] = strokeResults.flatMap(r => r.status === 'fulfilled' ? [{ type: 'freehand_strokes', strokes: r.value.strokes }] as BoardAction[] : [])

          const finalActions = [...others, ...strokeActions]
          if (finalActions.length) setBoardActions(prev => [...prev, ...finalActions])
        }
      }
    })
  }

  const handleClearBlackboard = () => {
    setBoardActions([])
  }

  return (
    <div className="classroom">
      <header className="classroom-header">
        <h1>🕌 AI Quran Teacher - Virtual Classroom</h1>
      </header>

      <div className="classroom-content">
        <div className="blackboard-section">
          <BlackboardExcalidraw onClear={handleClearBlackboard} actions={boardActions} />
        </div>

        <div className="chat-section">
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  )
}

// The previous rules-based generateAIResponse has been replaced by a backend call via /api/chat.

export default App
