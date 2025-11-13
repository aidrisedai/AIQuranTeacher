import 'dotenv/config'
import express from 'express'
import OpenAI from 'openai'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
const port = process.env.PORT ? Number(process.env.PORT) : 8787

app.use(express.json())

// Basic health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body || {}
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' })
    }

    // Short-circuit drawing phrasing to avoid disclaimers
    if (/\bdraw\b/i.test(message)) {
      return res.json({ reply: 'Drawing on the board.' })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' })
    }

    const client = new OpenAI({ apiKey })

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an AI Quran teacher using a virtual blackboard to illustrate answers. The board handles visuals. Never say you cannot draw or show. Keep responses concise (<= 2 sentences). For drawing-related requests, acknowledge succinctly (e.g., "Drawing on the board.") and proceed.' },
        { role: 'user', content: message },
      ],
      temperature: 0.2,
      max_tokens: 200,
    })

    const reply = completion.choices[0]?.message?.content ?? 'Ready.'
    res.json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch response from OpenAI' })
  }
})

// Plan board actions from a natural-language instruction
app.post('/api/plan', async (req, res) => {
  try {
    const { message } = req.body || {}
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' })
    }

    const client = new OpenAI({ apiKey })

    const sys = `You translate teacher instructions into drawing actions for a classroom blackboard.
Respond ONLY with strict JSON of the form { "actions": Action[] } where Action is one of:
- { "type": "write_text", "text": string, "rtl"?: boolean, "size"?: number, "color"?: string, "x"?: number, "y"?: number }
- { "type": "draw_shape", "shape": "circle"|"rect"|"line"|"arrow", "points"?: {"x":number,"y":number}[], "color"?: string, "width"?: number }
- { "type": "annotate_text", "note": string, "color"?: string }
- { "type": "freehand_request", "instruction": string, "color"?: string, "width"?: number, "style"?: "chalk"|"marker" }
Use freehand_request for objects like animals, letters, symbols, or anything that is not a simple primitive shape. If coordinates are omitted, choose sensible defaults. For Arabic text set rtl=true.`

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Try to extract JSON block if model added text
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : { actions: [] }
    }

    if (!parsed || !Array.isArray(parsed.actions)) parsed = { actions: [] }

    res.json({ actions: parsed.actions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to plan actions' })
  }
})

// Drawing agent: convert instruction into vector strokes (normalized 0..1 coordinates)
app.post('/api/draw', async (req, res) => {
  const { instruction, color, width, style } = req.body || {}
  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'Invalid instruction' })
  }

  // Local fallback generator for resilience when OpenAI is unavailable or errors
  const fallback = (why) => {
    try {
      const strokes = generateFallbackStrokes(String(instruction || ''), color, width)
      return res.json({ strokes })
    } catch (e) {
      console.error('Fallback draw failed:', e, 'original:', why)
      return res.status(500).json({ error: 'Failed to draw' })
    }
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('OPENAI_API_KEY missing, using fallback strokes')
      return fallback('no_api_key')
    }

    const client = new OpenAI({ apiKey })
    const sys = `You output simple hand-drawn sketches as JSON strokes.
Return ONLY JSON: { "strokes": Stroke[] }
Where Stroke = { "points": {"x": number, "y": number}[], "color"?: string, "width"?: number }.
Coordinates must be normalized between 0 and 1 (0 = left/top, 1 = right/bottom). Prefer 10–60 points per stroke.
Use few strokes to outline the object in a chalk/marker style. Avoid excessive detail.`

    // Small retry for transient 5xx/429
    let raw = null
    let lastErr = null
    for (let i = 0; i < 2; i++) {
      try {
        const completion = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: `Instruction: ${instruction}. Base style: ${style || 'chalk'}.` },
          ],
          temperature: 0.3,
          max_tokens: 600,
          response_format: { type: 'json_object' },
        })
        raw = completion.choices[0]?.message?.content || '{}'
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        await new Promise(r => setTimeout(r, 400))
      }
    }

    if (lastErr) {
      console.warn('OpenAI draw errored, using fallback:', lastErr?.message || lastErr)
      return fallback('openai_error')
    }

    // Safely parse JSON; if anything fails, use fallback
    const safeParse = (txt) => {
      try { return JSON.parse(txt) } catch (e1) {
        const m = typeof txt === 'string' ? txt.match(/\{[\s\S]*\}/) : null
        if (m) {
          try { return JSON.parse(m[0]) } catch (e2) { /* ignore */ }
        }
        return null
      }
    }

    const parsed = safeParse(raw)
    if (!parsed || !Array.isArray(parsed.strokes)) {
      return fallback('bad_json')
    }

    // Coerce and clamp
    const out = parsed.strokes
    if (!out.length) {
      // If model returned empty, degrade gracefully
      return fallback('empty_model_output')
    }
    for (const s of out) {
      if (!Array.isArray(s.points)) s.points = []
      s.points = s.points.map(p => ({
        x: Math.min(1, Math.max(0, Number(p.x))),
        y: Math.min(1, Math.max(0, Number(p.y))),
      }))
      if (color && !s.color) s.color = color
      if (width && !s.width) s.width = width
    }

    res.json({ strokes: out })
  } catch (err) {
    console.error('draw route fatal error:', err)
    return fallback('fatal_catch')
  }
})

// Simple heuristic strokes when AI is unavailable
function generateFallbackStrokes(instruction, color, width) {
  const col = color || 'white'
  const sw = !width ? 0.03 : (width < 1 ? width : Math.max(0.01, Math.min(0.1, width / 40)))
  const s = String(instruction || '').toLowerCase()
  const strokes = []

  const circle = (cx, cy, r, n = 28) => {
    const pts = []
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2
      pts.push({ x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) })
    }
    strokes.push({ points: pts, color: col, width: sw })
  }
  const rect = (x, y, w, h) => {
    const pts = [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }
    ]
    strokes.push({ points: pts, color: col, width: sw })
  }
  const line = (x1, y1, x2, y2) => {
    strokes.push({ points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], color: col, width: sw })
  }

  const vw = 1, vh = 1

  if (s.includes('circle')) {
    circle(0.5, 0.5, 0.25)
  } else if (s.includes('rectangle') || s.includes('square') || s.includes('box')) {
    rect(0.2, 0.25, 0.6, 0.4)
  } else if (s.includes('arrow')) {
    line(0.2, 0.5, 0.8, 0.5)
    // arrow head
    line(0.8, 0.5, 0.75, 0.47)
    line(0.8, 0.5, 0.75, 0.53)
  } else if (s.includes('line')) {
    line(0.2, 0.2, 0.8, 0.8)
  } else if (s.includes('cat')) {
    // Simple cat: head circle, ears, body oval, tail curve
    circle(0.35, 0.4, 0.12, 22)
    strokes.push({ points: [ { x: 0.29, y: 0.29 }, { x: 0.33, y: 0.24 }, { x: 0.37, y: 0.29 } ], color: col, width: sw })
    strokes.push({ points: [ { x: 0.41, y: 0.29 }, { x: 0.45, y: 0.24 }, { x: 0.49, y: 0.29 } ], color: col, width: sw })
    // body
    const body = []
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * Math.PI * 2
      body.push({ x: 0.38 + 0.18 * Math.cos(t), y: 0.58 + 0.24 * Math.sin(t) })
    }
    strokes.push({ points: body, color: col, width: sw })
    // tail
    strokes.push({ points: [ { x: 0.52, y: 0.58 }, { x: 0.60, y: 0.50 }, { x: 0.66, y: 0.48 }, { x: 0.70, y: 0.50 } ], color: col, width: sw })
  } else if (s.match(/[\u0600-\u06FF]/)) {
    // Arabic letter rough stroke (baseline curve)
    strokes.push({ points: [ { x: 0.2, y: 0.5 }, { x: 0.4, y: 0.45 }, { x: 0.6, y: 0.55 }, { x: 0.8, y: 0.5 } ], color: col, width: sw })
  } else {
    // Scribble fallback
    strokes.push({ points: [ { x: 0.2, y: 0.6 }, { x: 0.3, y: 0.4 }, { x: 0.45, y: 0.65 }, { x: 0.6, y: 0.35 }, { x: 0.8, y: 0.6 } ], color: col, width: sw })
  }

  return strokes
}

// Serve production build if present
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '../dist')
try {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next()
    })
  })
} catch (e) {
  console.warn('Static serving not configured:', e?.message || e)
}

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
