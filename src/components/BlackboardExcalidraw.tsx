import { useEffect, useMemo, useRef, useCallback } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { BoardAction, Stroke } from '../App'
import './Blackboard.css'

interface Props {
  actions?: BoardAction[]
  onClear: () => void
}

// Map our BoardAction to Excalidraw element objects
function toElements(action: BoardAction, dims?: { width: number; height: number; padX: number; padY: number }) {
  const now = Date.now()
  // Helper to construct element base
  const base = (partial: any) => ({ id: `el-${now}-${Math.random().toString(36).slice(2)}`, angle: 0, locked: false, ...partial })

  // Default dimensions (fallback)
  const { width = 800, height = 500, padX = 40, padY = 40 } = dims || {}
  const boxW = width - padX * 2
  const boxH = height - padY * 2

  switch (action.type) {
    case 'write_text': {
      const x = action.x ?? 120, y = action.y ?? 100
      return [base({
        type: 'text',
        x, y, width: 0, height: 0,
        text: action.text,
        fontSize: action.size ?? 28,
        fontFamily: 1,
        textAlign: action.rtl ? 'right' : 'left',
        strokeColor: action.color ?? '#ffffff',
        backgroundColor: 'transparent',
        fillStyle: 'hachure',
        groupIds: [],
      })]
    }
    case 'draw_shape': {
      const color = action.color ?? '#ffd54a'
      const w = action.width ?? 6
      const pts = action.points ?? [{ x: 140, y: 140 }, { x: 260, y: 140 }]

      if (action.shape === 'circle') {
        const c = pts[0] ?? { x: 200, y: 180 }
        const r = pts[1] ?? { x: 60, y: 60 }
        const rx = typeof r.x === 'number' ? r.x : 60
        const ry = typeof r.y === 'number' ? r.y : rx
        return [base({ type: 'ellipse', x: c.x - rx, y: c.y - ry, width: rx * 2, height: ry * 2, strokeColor: color, strokeWidth: w, backgroundColor: 'transparent', groupIds: [] })]
      }
      if (action.shape === 'rect') {
        const p1 = pts[0] ?? { x: 100, y: 120 }
        const p2 = pts[1] ?? { x: 260, y: 220 }
        const x = p1.x, y = p1.y
        const width = p2.x - p1.x
        const height = p2.y - p1.y
        return [base({ type: 'rectangle', x, y, width, height, strokeColor: color, strokeWidth: w, backgroundColor: 'transparent', groupIds: [] })]
      }
      if (action.shape === 'line' || action.shape === 'arrow') {
        const a = pts[0] ?? { x: 100, y: 100 }
        const b = pts[1] ?? { x: 260, y: 100 }
        return [base({
          type: action.shape,
          x: a.x,
          y: a.y,
          points: [[0, 0], [b.x - a.x, b.y - a.y]],
          strokeColor: color,
          strokeWidth: w,
          backgroundColor: 'transparent',
          groupIds: [],
        })]
      }
      return []
    }
    case 'freehand_strokes': {
      const mk = (s: Stroke) => base({
        type: 'freedraw',
        x: padX,
        y: padY,
        strokeColor: s.color ?? '#ffffff',
        strokeWidth: s.width ?? 6,
        backgroundColor: 'transparent',
        points: (s.points ?? []).map(p => [p.x * boxW, p.y * boxH]),
        groupIds: [],
      })
      return action.strokes.map(mk)
    }
    default:
      return []
  }
}

export default function BlackboardExcalidraw({ actions, onClear }: Props) {
  const apiRef = useRef<any>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Get dynamic canvas dimensions
  const getCanvasDimensions = useCallback(() => {
    const wrap = containerRef.current
    if (!wrap) return { width: 800, height: 500, padX: 40, padY: 40 }
    const w = wrap.clientWidth || 800
    const h = wrap.clientHeight || 500
    return { width: w, height: h, padX: 40, padY: 40 }
  }, [])

  // Derived elements for the incoming actions (for Excalidraw-native shapes)
  const incoming = useMemo(() => {
    const dims = getCanvasDimensions()
    return (actions ?? []).flatMap(action => toElements(action, dims))
  }, [actions, getCanvasDimensions])

  // Add elements to Excalidraw when present
  useEffect(() => {
    const api = apiRef.current
    if (!api || incoming.length === 0) return
    const current = api.getSceneElements() ?? []
    api.updateScene({ elements: [...current, ...incoming] })
  }, [incoming])

  // Simple programmatic overlay so actions are always visible even if Excalidraw rejects elements
  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current
    const wrap = containerRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const pad = 24

    ;(actions || []).forEach((a) => {
      if (a.type === 'write_text') {
        const size = a.size || 28
        ctx.font = `${size}px "Gloria Hallelujah", system-ui, sans-serif`
        ctx.fillStyle = a.color || '#fafafa'
        const x = (a.x ?? pad)
        const y = (a.y ?? pad) + size
        if (a.rtl) {
          ctx.textAlign = 'right'
          ctx.fillText(a.text, w - pad, y)
          ctx.textAlign = 'left'
        } else {
          ctx.fillText(a.text, x, y)
        }
      } else if (a.type === 'draw_shape') {
        const color = a.color || '#ffd54a'
        const width = a.width || 6
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const pts = a.points || []
        if (a.shape === 'circle') {
          const cx = pts[0]?.x ?? w / 2
          const cy = pts[0]?.y ?? h / 2
          const r = (pts[1]?.x ?? 60)
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.stroke()
        } else if (a.shape === 'rect') {
          const x = pts[0]?.x ?? pad
          const y = pts[0]?.y ?? pad
          const rw = pts[1]?.x ?? 200
          const rh = pts[1]?.y ?? 120
          ctx.strokeRect(x, y, rw, rh)
        } else if (a.shape === 'line' || a.shape === 'arrow') {
          const A = pts[0] || { x: pad, y: pad }
          const B = pts[1] || { x: pad + 200, y: pad }
          ctx.beginPath()
          ctx.moveTo(A.x, A.y)
          ctx.lineTo(B.x, B.y)
          ctx.stroke()
          if (a.shape === 'arrow') {
            const ang = Math.atan2(B.y - A.y, B.x - A.x)
            const len = 14
            ctx.beginPath()
            ctx.moveTo(B.x, B.y)
            ctx.lineTo(B.x - len * Math.cos(ang - Math.PI / 6), B.y - len * Math.sin(ang - Math.PI / 6))
            ctx.moveTo(B.x, B.y)
            ctx.lineTo(B.x - len * Math.cos(ang + Math.PI / 6), B.y - len * Math.sin(ang + Math.PI / 6))
            ctx.stroke()
          }
        }
      } else if (a.type === 'freehand_strokes') {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const boxW = w - pad * 2
        const boxH = h - pad * 2
        a.strokes.forEach((s) => {
          const color = s.color || '#fafafa'
          const pxWidth = !s.width ? 6 : (s.width < 1 ? s.width * 40 : s.width)
          ctx.strokeStyle = color
          ctx.lineWidth = pxWidth
          const pts = s.points || []
          if (pts.length >= 2) {
            ctx.beginPath()
            ctx.moveTo(pad + pts[0].x * boxW, pad + pts[0].y * boxH)
            for (let i = 1; i < pts.length; i++) {
              const p = pts[i]
              ctx.lineTo(pad + p.x * boxW, pad + p.y * boxH)
            }
            ctx.stroke()
          }
        })
      }
    })
  }, [actions])

  useEffect(() => {
    drawOverlay()
    const onResize = () => drawOverlay()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [drawOverlay])

  return (
    <div className="blackboard" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="blackboard-frame" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="blackboard-header">
          <div className="blackboard-title">📝 Classroom Blackboard</div>
          <button className="eraser-button" onClick={() => { apiRef.current?.updateScene({ elements: [] }); onClear(); drawOverlay(); }}>
            🧽 Clear
          </button>
        </div>
        <div className="blackboard-content" ref={containerRef} style={{ padding: 0, position: 'relative' }}>
          <div style={{ height: '100%', width: '100%' }}>
            <Excalidraw excalidrawAPI={(api) => (apiRef.current = api)} UIOptions={{ canvasActions: { saveToActiveFile: false } }} />
          </div>
          {/* Programmatic overlay canvas (pointer-events none so Excalidraw remains interactive) */}
          <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        </div>
      </div>
    </div>
  )
}
