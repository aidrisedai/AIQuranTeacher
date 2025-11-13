import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import type { BoardAction, Stroke } from '../App'
import './Blackboard.css'

interface Props {
  actions?: BoardAction[]
  onClear: () => void
}

export default function FabricBoard({ actions, onClear }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabRef = useRef<any>(null)

  // init fabric
  useEffect(() => {
    if (!canvasRef.current || fabRef.current) return
    const c = new fabric.Canvas(canvasRef.current, {
      selection: true,
      renderOnAddRemove: true,
    })
    fabRef.current = c

    const resize = () => {
      const w = wrapRef.current?.clientWidth || 800
      const h = wrapRef.current?.clientHeight || 500
      c.setWidth(w)
      c.setHeight(h)
      c.requestRenderAll()
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      ro.disconnect()
      c.dispose()
      fabRef.current = null
    }
  }, [])

  // consume actions
  useEffect(() => {
    if (!actions || actions.length === 0) return
    const c = fabRef.current
    if (!c) return
    const pad = 24

    actions.forEach(a => {
      if (a.type === 'write_text') {
        const size = a.size ?? 28
        const color = a.color ?? '#fafafa'
        const w = c.getWidth() || 800
        const text = new fabric.Textbox(a.text, {
          left: a.x ?? pad,
          top: a.y ?? pad,
          fontSize: size,
          fill: color,
          width: Math.min(600, w - pad * 2),
          textAlign: a.rtl ? 'right' : 'left',
        })
        c.add(text)
      } else if (a.type === 'draw_shape') {
        const color = a.color ?? '#ffd54a'
        const width = a.width ?? 6
        const pts = a.points || []
        if (a.shape === 'circle') {
          const cx = pts[0]?.x ?? 240
          const cy = pts[0]?.y ?? 180
          const r = pts[1]?.x ?? 60
          const circ = new fabric.Circle({
            left: cx - r,
            top: cy - r,
            radius: r,
            stroke: color,
            strokeWidth: width,
            fill: 'transparent',
          })
          c.add(circ)
        } else if (a.shape === 'rect') {
          const x = pts[0]?.x ?? pad
          const y = pts[0]?.y ?? pad
          const w = pts[1]?.x ?? 200
          const h = pts[1]?.y ?? 120
          const rect = new fabric.Rect({
            left: x,
            top: y,
            width: w,
            height: h,
            stroke: color,
            strokeWidth: width,
            fill: 'transparent',
          })
          c.add(rect)
        } else if (a.shape === 'line' || a.shape === 'arrow') {
          const A = pts[0] || { x: pad, y: pad }
          const B = pts[1] || { x: pad + 200, y: pad }
          const line = new fabric.Line([A.x, A.y, B.x, B.y], {
            stroke: color,
            strokeWidth: width,
          })
          c.add(line)
          if (a.shape === 'arrow') {
            const ang = Math.atan2(B.y - A.y, B.x - A.x)
            const len = 12
            const p1 = { x: B.x - len * Math.cos(ang - Math.PI / 6), y: B.y - len * Math.sin(ang - Math.PI / 6) }
            const p2 = { x: B.x - len * Math.cos(ang + Math.PI / 6), y: B.y - len * Math.sin(ang + Math.PI / 6) }
            const head = new fabric.Polyline([
              { x: B.x, y: B.y },
              p1,
              p2,
            ], {
              stroke: color,
              strokeWidth: width,
              fill: 'transparent',
            })
            c.add(head)
          }
        }
      } else if (a.type === 'freehand_strokes') {
        const w = c.getWidth() || 800
        const h = c.getHeight() || 500
        const boxW = w - pad * 2
        const boxH = h - pad * 2
        a.strokes.forEach((s: Stroke) => {
          const col = s.color ?? '#fafafa'
          const sw = !s.width ? 6 : (s.width < 1 ? s.width * 40 : s.width)
          const points = (s.points || []).map(p => ({ x: pad + p.x * boxW, y: pad + p.y * boxH }))
          if (points.length >= 2) {
            const poly = new fabric.Polyline(points, {
              stroke: col,
              strokeWidth: sw,
              fill: 'transparent',
            })
            c.add(poly)
          }
        })
      }
    })

    c.requestRenderAll()
  }, [actions])

  return (
    <div className="blackboard" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="blackboard-frame" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="blackboard-header">
          <div className="blackboard-title">📝 Classroom Blackboard</div>
          <button className="eraser-button" onClick={() => { fabRef.current?.clear(); onClear() }}>🧽 Clear</button>
        </div>
        <div className="blackboard-content" ref={wrapRef} style={{ padding: 0 }}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  )
}
