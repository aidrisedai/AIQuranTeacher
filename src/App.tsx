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
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

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
        const errorMsg = chatRes.reason?.message || String(chatRes.reason)
        const assistantMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: errorMsg.includes('OPENAI_API_KEY')
            ? '⚠️ OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.'
            : `Sorry, I couldn't get a response right now. (${errorMsg})`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      }

      let planned: BoardAction[] = []
      if (planRes.status === 'fulfilled') {
        planned = planRes.value.actions || []
      } else {
        console.warn('Plan API failed:', planRes.reason)
      }

      // Always process drawing commands even if chat fails
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

      setIsLoading(false)
    }).catch((err) => {
      console.error('Unexpected error:', err)
      setIsLoading(false)
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
          <ChatInterface messages={messages} onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}

// The previous rules-based generateAIResponse has been replaced by a backend call via /api/chat.

export default App
