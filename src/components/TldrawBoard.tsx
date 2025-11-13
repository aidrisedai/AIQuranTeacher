import { useEffect, useRef } from 'react'
import { Tldraw, createShapeId } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import type { BoardAction, Stroke } from '../App'
import './Blackboard.css'

// We keep editor as any to avoid coupling to TL types while integrating quickly.
export default function TldrawBoard({ actions, onClear }: { actions?: BoardAction[]; onClear: () => void }) {
  const editorRef = useRef<any>(null)

  // helper to map numeric widths to tldraw token sizes
  const toSize = (n?: number): 's' | 'm' | 'l' | 'xl' => {
    if (!n) return 'm'
    const v = Number(n)
    if (!Number.isFinite(v)) return 'm'
    if (v <= 2) return 's'
    if (v <= 4) return 'm'
    if (v <= 6) return 'l'
    return 'xl'
  }

  const allowedColors = new Set(['black','grey','light-violet','violet','blue','light-blue','yellow','orange','green','light-green','light-red','red','white'])
  const normColor = (c?: string) => {
    if (!c) return undefined
    // take the first token only (defensive against 'red width=4')
    const low = String(c).toLowerCase().trim().split(/[\s,;]+/)[0]
    if (allowedColors.has(low)) return low as any
    // Map common aliases and hex-ish to nearest tokens
    if (/^#|rgb\(/.test(low)) return 'white'
    if (low.includes('gray')) return 'grey'
    if (low === 'lightgreen') return 'light-green'
    if (low === 'lightblue') return 'light-blue'
    if (low === 'lightred') return 'light-red'
    return 'white'
  }

  // small helpers
  const isNum = (v: any) => Number.isFinite(Number(v))
  const n = (v: any, d: number) => (isNum(v) ? Number(v) : d)

  // convert absolute points to local points with origin at min(x,y)
  const toLocal = (pts: { x: number; y: number; z?: number }[]) => {
    const xs = pts.map(p => n(p.x, 0))
    const ys = pts.map(p => n(p.y, 0))
    const minX = xs.length ? Math.min(...xs) : 0
    const minY = ys.length ? Math.min(...ys) : 0
    const local = pts.map(p => ({ x: n(p.x, 0) - minX, y: n(p.y, 0) - minY, z: isNum(p.z) ? Number(p.z) : 0.5 }))
    return { x: minX, y: minY, points: local }
  }

  // Doc-aligned builders
  const buildText = ({ x, y, text, size }: { x: number; y: number; text: string; size?: number }) => ({
    id: createShapeId(),
    type: 'text',
    x: n(x, 0),
    y: n(y, 0),
    props: { text: String(text), size: toSize(size) },
  })
  const buildGeoRect = ({ x, y, w, h, color, width }: { x: number; y: number; w: number; h: number; color?: string; width?: number }) => ({
    id: createShapeId(),
    type: 'geo',
    x: n(x, 0),
    y: n(y, 0),
    props: {
      w: Math.max(2, n(w, 200)),
      h: Math.max(2, n(h, 120)),
      geo: 'rectangle',
      dash: 'draw',
      color: normColor(color) ?? 'yellow',
      size: toSize(width ?? 3),
      fill: 'none',
    },
  })
  const buildGeoCircle = ({ cx, cy, r, color, width }: { cx: number; cy: number; r: number; color?: string; width?: number }) => {
    const R = Math.max(1, Math.abs(n(r, 60)))
    return {
      id: createShapeId(),
      type: 'geo',
      x: n(cx, 0) - R,
      y: n(cy, 0) - R,
      props: {
        w: R * 2,
        h: R * 2,
        geo: 'ellipse',
        dash: 'draw',
        color: normColor(color) ?? 'yellow',
        size: toSize(width ?? 3),
        fill: 'none',
      },
    }
  }
  const buildDrawFromAbs = ({ points, color, width }: { points: { x: number; y: number }[]; color?: string; width?: number }) => {
    if (!points || points.length < 2) return null
    const withZ = points.map(p => ({ x: n(p.x, 0), y: n(p.y, 0), z: 0.5 }))
    const { x, y, points: local } = toLocal(withZ)
    return {
      id: createShapeId(),
      type: 'draw',
      x,
      y,
      props: {
        color: normColor(color) ?? 'white',
        size: toSize(width ?? 3),
        isComplete: true,
        segments: [{ type: 'free', points: local }],
      },
    }
  }

  // Apply actions
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !actions || actions.length === 0) return

    const pad = 24


    actions.forEach((a) => {
      if (a.type === 'write_text') {
        const x = (a as any).x ?? pad
        const y = (a as any).y ?? pad
        const rec = buildText({ x, y, text: a.text, size: a.size })
        editor.createShapes([rec])
      } else if (a.type === 'draw_shape') {
        const color = a.color
        const size = a.width ?? 3
        const pts = a.points || []
        if (a.shape === 'circle') {
          const cx = n(pts[0]?.x, 240)
          const cy = n(pts[0]?.y, 180)
          const r = Math.abs(n(pts[1]?.x, 60))
          const rec = buildGeoCircle({ cx, cy, r, color, width: size })
          editor.createShapes([rec])
        } else if (a.shape === 'rect') {
          const x = n(pts[0]?.x, pad)
          const y = n(pts[0]?.y, pad)
          const w = Math.max(2, n(pts[1]?.x, 200))
          const h = Math.max(2, n(pts[1]?.y, 120))
          const rec = buildGeoRect({ x, y, w, h, color, width: size })
          editor.createShapes([rec])
        } else if (a.shape === 'line' || a.shape === 'arrow') {
          const A = pts[0] || { x: pad, y: pad }
          const B = pts[1] || { x: pad + 200, y: pad }
          const rec = buildDrawFromAbs({ points: [A, B], color, width: size })
          if (rec) editor.createShapes([rec])
          if (a.shape === 'arrow') {
            const ang = Math.atan2(B.y - A.y, B.x - A.x)
            const len = 14
            const p1 = { x: B.x - len * Math.cos(ang - Math.PI / 6), y: B.y - len * Math.sin(ang - Math.PI / 6) }
            const p2 = { x: B.x - len * Math.cos(ang + Math.PI / 6), y: B.y - len * Math.sin(ang + Math.PI / 6) }
            const head = buildDrawFromAbs({ points: [{ x: B.x, y: B.y }, p1, p2], color, width: size })
            if (head) editor.createShapes([head])
          }
        }
      } else if (a.type === 'freehand_strokes') {
        const padW = pad
        const padH = pad
        // Map normalized 0..1 points to the viewport by using current viewport page bounds
        const viewport = editor.getViewportPageBounds?.()
        const vp = viewport && Number.isFinite(viewport.x) ? viewport : { x: 0, y: 0, w: 1000, h: 700 }
        const bx = vp.x + padW
        const by = vp.y + padH
        const bw = (vp.w ?? 1000) - padW * 2
        const bh = (vp.h ?? 700) - padH * 2
        a.strokes.forEach((s: Stroke) => {
          const color = s.color
          const numeric = !s.width ? 3 : s.width < 1 ? s.width * 40 : s.width
          const absPts = (s.points || []).map((p) => ({ x: bx + p.x * bw, y: by + p.y * bh }))
          const rec = buildDrawFromAbs({ points: absPts, color, width: numeric })
          if (rec) editor.createShapes([rec])
        })
      }
    })

  }, [actions])

  return (
    <div className="blackboard" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="blackboard-frame" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="blackboard-header">
          <div className="blackboard-title">📝 Classroom Blackboard</div>
          <button className="eraser-button" onClick={() => { try { const ed = editorRef.current; ed?.selectAll(); const ids = ed?.getSelectedShapeIds?.() || []; if (ids.length) ed?.deleteShapes(ids); ed?.deselectAll?.(); } catch {} onClear() }}>🧽 Clear</button>
        </div>
        <div className="blackboard-content" style={{ padding: 0 }}>
          <Tldraw
            onMount={(editor: any) => {
              editorRef.current = editor
            }}
            inferDarkMode
            autoFocus
          />
        </div>
      </div>
    </div>
  )
}
