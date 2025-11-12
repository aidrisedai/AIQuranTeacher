import { useCallback, useEffect, useMemo, useRef } from 'react'
import './Blackboard.css'
import type { BoardAction } from '../App'

interface BlackboardProps {
  content: string
  onClear: () => void
  actions?: BoardAction[]
}

// Simple LTR/RTL line layout: collect lines from actions or fallback to content
function layoutLinesFromActions(actions?: BoardAction[], fallback?: string): { lines: { text: string; rtl?: boolean; size?: number; color?: string }[] } {
  if (!actions || actions.length === 0) {
    const text = fallback || ''
    if (!text) return { lines: [] }
    return { lines: text.split(/\r?\n/).map(t => ({ text: t })) }
  }
  const out: { text: string; rtl?: boolean; size?: number; color?: string }[] = []
  for (const a of actions) {
    if (a.type === 'write_text') {
      out.push({ text: a.text, rtl: a.rtl, size: a.size, color: a.color })
    }
  }
  return { lines: out }
}

function Blackboard({ content, onClear, actions }: BlackboardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  // Animation progress per line (0..1)
  const progressRef = useRef<number[]>([])
  const linesRef = useRef<{ text: string; rtl?: boolean; size?: number; color?: string }[]>([])
  const fontReadyRef = useRef(false)

  const shapeActions = useMemo(() => (actions || []).filter(a => a.type === 'draw_shape') as Extract<BoardAction, { type: 'draw_shape' }>[], [actions])
  const strokeActions = useMemo(() => (actions || []).filter(a => a.type === 'freehand_strokes') as Extract<BoardAction, { type: 'freehand_strokes' }>[], [actions])

  // Resize canvas to container with devicePixelRatio
  const resizeCanvas = useCallback(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const dpr = window.devicePixelRatio || 1
    const { clientWidth: w, clientHeight: h } = container
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
  }, [])

  // Prepare fonts
  useEffect(() => {
    let cancelled = false
    const ready = (document as any).fonts?.ready as Promise<unknown> | undefined
    if (ready) {
      ready.then(() => {
        if (!cancelled) fontReadyRef.current = true
      })
    } else {
      fontReadyRef.current = true
    }
    return () => { cancelled = true }
  }, [])

  // Update lines from actions (fallback to content) and initialize progress when input changes
  useEffect(() => {
    const { lines } = layoutLinesFromActions(actions, content)
    const old = linesRef.current
    const oldTexts = old.map(l => l.text)
    const newTexts = lines.map(l => l.text)

    const appended = newTexts.length >= oldTexts.length && newTexts.slice(0, oldTexts.length).join('\n') === oldTexts.join('\n')

    linesRef.current = lines
    const nextProgress = lines.map((_, i) => (appended && i < old.length ? 1 : 0))
    progressRef.current = nextProgress
  }, [actions, content])

  // Main animation loop: draw using a masking brush that reveals text
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // reset to logical pixels

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Text style
    const defaultFontSize = 22
    ctx.font = `${defaultFontSize}px "Gloria Hallelujah", system-ui, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#fafafa'
    ctx.shadowColor = 'rgba(255,255,255,0.35)'
    ctx.shadowBlur = 2

    const padding = 16
    const lineGap = 12
    let y = padding

    const lines = linesRef.current
    const progresses = progressRef.current

    for (let i = 0; i < lines.length; i++) {
      const { text, size, color, rtl } = lines[i]
      const progress = progresses[i] ?? 1

      // Apply per-line style
      const fontSize = size || defaultFontSize
      ctx.font = `${fontSize}px "Gloria Hallelujah", system-ui, sans-serif`
      ctx.fillStyle = color || '#fafafa'

      // Pre-measure line width
      const metrics = ctx.measureText(text)
      const lineHeight = fontSize + 2
      const width = Math.max(0, metrics.width)

      // Draw text to offscreen
      const off = document.createElement('canvas')
      off.width = Math.max(1, Math.ceil(width + 4))
      off.height = Math.max(1, Math.ceil(lineHeight + 4))
      const octx = off.getContext('2d')!
      octx.setTransform(1, 0, 0, 1, 0, 0)
      octx.font = ctx.font
      octx.textBaseline = 'top'
      octx.fillStyle = ctx.fillStyle
      octx.shadowColor = ctx.shadowColor as string
      octx.shadowBlur = 1.5
      // RTL: draw with right alignment by shifting x
      const textX = rtl ? off.width - width : 0
      octx.fillText(text, textX, 0)

      // Paste text onto main
      ctx.save()
      const drawX = rtl ? padding + Math.max(0, 0) : padding
      ctx.drawImage(off, drawX, y)

      // Mask with brush trail left-to-right up to progress
      ctx.globalCompositeOperation = 'destination-in'

      const brushRadius = 8
      const maxX = padding + width * progress
      const step = 6
      for (let x = padding; x <= maxX; x += step) {
        // little jitter to simulate hand
        const jitterY = y + lineHeight / 2 + Math.sin(x * 0.15) * 1.5
        const grad = ctx.createRadialGradient(x, jitterY, 0, x, jitterY, brushRadius)
        grad.addColorStop(0, 'rgba(255,255,255,0.85)')
        grad.addColorStop(1, 'rgba(255,255,255,0.0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x, jitterY, brushRadius, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()

      y += lineHeight + lineGap
    }

    // Draw shapes (simple stroke)
    for (const s of shapeActions) {
      const color = s.color || '#ffd54a'
      const width = s.width && s.width < 1 ? s.width * 40 : (s.width || 6)
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const pts = s.points && s.points.length ? s.points : undefined
      if (s.shape === 'circle') {
        const cx = pts?.[0]?.x ?? (canvas.width / dpr) / 2
        const cy = pts?.[0]?.y ?? (canvas.height / dpr) / 2
        const r = pts?.[1]?.x ?? 60
        ctx.beginPath()
        ctx.arc(cx, cy, typeof r === 'number' ? r : 60, 0, Math.PI * 2)
        ctx.stroke()
      } else if (s.shape === 'rect') {
        const x = pts?.[0]?.x ?? 40
        const y = pts?.[0]?.y ?? 40
        const w = pts?.[1]?.x ?? 180
        const h = pts?.[1]?.y ?? 100
        ctx.strokeRect(x, y, w, h)
      } else if (s.shape === 'line' || s.shape === 'arrow') {
        const a = pts?.[0] || { x: 40, y: 40 }
        const b = pts?.[1] || { x: 220, y: 40 }
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        if (s.shape === 'arrow') {
          const angle = Math.atan2(b.y - a.y, b.x - a.x)
          const len = 12
          ctx.beginPath()
          ctx.moveTo(b.x, b.y)
          ctx.lineTo(b.x - len * Math.cos(angle - Math.PI / 6), b.y - len * Math.sin(angle - Math.PI / 6))
          ctx.moveTo(b.x, b.y)
          ctx.lineTo(b.x - len * Math.cos(angle + Math.PI / 6), b.y - len * Math.sin(angle + Math.PI / 6))
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    // Draw freehand strokes (normalized coordinates 0..1)
    for (const bundle of strokeActions) {
      for (const s of bundle.strokes) {
        const color = s.color || '#fafafa'
        const pxWidth = !s.width ? 6 : (s.width < 1 ? s.width * 40 : s.width)
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = pxWidth
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const pts = s.points || []
        if (pts.length >= 2) {
          const w = (canvas.width / dpr) - padding * 2
          const h = (canvas.height / dpr) - padding * 2
          ctx.beginPath()
          ctx.moveTo(padding + pts[0].x * w, padding + pts[0].y * h)
          for (let i = 1; i < pts.length; i++) {
            const p = pts[i]
            ctx.lineTo(padding + p.x * w, padding + p.y * h)
          }
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    // Chalk dust overlay
    ctx.save()
    ctx.globalAlpha = 0.06
    for (let i = 0; i < 120; i++) {
      const rx = padding + Math.random() * (canvas.width / dpr - padding * 2)
      const ry = Math.random() * (canvas.height / dpr)
      ctx.fillStyle = 'white'
      ctx.fillRect(rx, ry, 1, 1)
    }
    ctx.restore()
  }, [shapeActions])

  // Animate progress advance
  const tick = useCallback(() => {
    const progresses = progressRef.current
    let anyActive = false

    for (let i = 0; i < progresses.length; i++) {
      if (progresses[i] < 1) {
        anyActive = true
        const speed = 0.015 // fraction per frame at ~60fps ≈ 0.9s per short line
        // Slight variability
        progresses[i] = Math.min(1, progresses[i] + speed * (0.8 + Math.random() * 0.6))
        break // write one line at a time
      }
    }

    draw()

    if (anyActive) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      rafRef.current = null
    }
  }, [draw])

  // Start animation when content or size changes
  useEffect(() => {
    resizeCanvas()
    draw()
    if (rafRef.current == null && progressRef.current.some((p) => p < 1)) {
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [content, draw, resizeCanvas, tick])

  // Handle resizes
  useEffect(() => {
    const onResize = () => {
      resizeCanvas()
      draw()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw, resizeCanvas])

  // Reset when cleared
  useEffect(() => {
    if (!content) {
      linesRef.current = []
      progressRef.current = []
      const c = canvasRef.current
      if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    }
  }, [content])

  return (
    <div className="blackboard">
      <div className="blackboard-frame">
        <div className="blackboard-header">
          <div className="blackboard-title">📝 Classroom Blackboard</div>
          <button className="eraser-button" onClick={onClear} title="Clear blackboard">
            🧽 Clear
          </button>
        </div>

        <div className="blackboard-content" ref={containerRef}>
          <canvas ref={canvasRef} className="blackboard-canvas" />
        </div>

        <div className="chalk-tray">
          <div className="chalk chalk-white"></div>
          <div className="chalk chalk-yellow"></div>
          <div className="chalk chalk-green"></div>
          <div className="chalk chalk-blue"></div>
        </div>
      </div>
    </div>
  )
}

export default Blackboard
