import 'dotenv/config'
import express from 'express'
import OpenAI from 'openai'

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
  try {
    const { instruction, color, width, style } = req.body || {}
    if (!instruction || typeof instruction !== 'string') {
      return res.status(400).json({ error: 'Invalid instruction' })
    }
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' })

    const client = new OpenAI({ apiKey })
    const sys = `You output simple hand-drawn sketches as JSON strokes.
Return ONLY JSON: { "strokes": Stroke[] }
Where Stroke = { "points": {"x": number, "y": number}[], "color"?: string, "width"?: number }.
Coordinates must be normalized between 0 and 1 (0 = left/top, 1 = right/bottom). Prefer 10–60 points per stroke.
Use few strokes to outline the object in a chalk/marker style. Avoid excessive detail.`

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

    const raw = completion.choices[0]?.message?.content || '{}'
    let parsed = { strokes: [] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      const m = raw.match(/\{[\s\S]*\}/)
      parsed = m ? JSON.parse(m[0]) : { strokes: [] }
    }

    // Coerce and clamp
    const out = Array.isArray(parsed.strokes) ? parsed.strokes : []
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
    console.error(err)
    res.status(500).json({ error: 'Failed to draw' })
  }
})

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`)
})
