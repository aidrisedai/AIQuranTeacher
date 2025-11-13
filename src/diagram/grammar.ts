// Lightweight DSL parser that converts diagram commands into BoardAction[]
// Supported commands (per line) examples:
// - write "text" at (x,y) size=32 color=white
// - box "Label" at (x,y) w=240 h=120 color=yellow
// - circle at (cx,cy) r=60 color=yellow width=4
// - arrow (x1,y1) -> (x2,y2) color=red width=4
// - flow A -> B -> C  layout=horizontal  at (120,140)  spacing=220  w=220 h=120 color=yellow
// Prefixes: diagram: ..., flow: ... (single-line convenience)

import type { BoardAction } from '../App'

const NUM = /-?\d+(?:\.\d+)?/;

function pickSizeToken(n?: number): number | undefined {
  // Keep numeric; TldrawBoard will convert to tokens.
  return n
}

function parsePoint(s: string): { x: number; y: number } | null {
  const m = s.match(new RegExp(`\(\s*(${NUM.source})\s*,\s*(${NUM.source})\s*\)`))
  if (!m) return null
  return { x: Number(m[1]), y: Number(m[2]) }
}

function parseParams(s: string): Map<string,string> {
  const map = new Map<string,string>()
  for (const m of s.matchAll(/(\w+)=((?:\"[^\"]+\")|\S+)/g)) {
    const key = m[1].toLowerCase()
    const val = m[2].replace(/^\"|\"$/g, '')
    map.set(key, val)
  }
  return map
}
function kv(s: string, key: string): string | undefined {
  return parseParams(s).get(key.toLowerCase())
}

function kvNum(s: string, key: string): number | undefined {
  const v = kv(s, key)
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function colorFrom(s: string): string | undefined {
  return kv(s, 'color')
}

export function parseDSLToActions(input: string): BoardAction[] {
  if (!input) return []
  // Normalize; allow multiline scripts
  const src = input.trim()
  const lines = src.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const actions: BoardAction[] = []

  for (let raw of lines) {
    let line = raw
    if (/^diagram:/i.test(line)) line = line.replace(/^diagram:\s*/i, '')
    if (/^flow:/i.test(line)) line = line.replace(/^flow:\s*/i, 'flow ')

    // flow A -> B -> C ...
    if (/^flow\b/i.test(line)) {
      // options
      const at = parsePoint(kv(line, 'at') || '') || { x: 120, y: 140 }
      const spacing = kvNum(line, 'spacing') ?? 220
      const w = kvNum(line, 'w') ?? 220
      const h = kvNum(line, 'h') ?? 120
      const color = colorFrom(line) || 'yellow'
      const width = kvNum(line, 'width') ?? 3

      // strip options to get the chain portion
      const chain = line.replace(/\s+\w+=([^\s]+)/g, '').replace(/^flow\s*/i, '')
      const labels = chain.split(/->/).map(s => s.trim()).filter(Boolean)
      let x = at.x
      const y = at.y
      const nodeCenters: { [k: string]: { x: number; y: number } } = {}
      labels.forEach((label) => {
        actions.push({ type: 'draw_shape', shape: 'rect', points: [{ x, y }, { x: w, y: h }], color, width })
        // text centered with a small padding
        actions.push({ type: 'write_text', text: label, size: pickSizeToken(22), color: undefined, x: x + 12, y: y + 12 })
        nodeCenters[label] = { x: x + w / 2, y: y + h / 2 }
        x += spacing
      })
      for (let i = 0; i < labels.length - 1; i++) {
        const A = nodeCenters[labels[i]]
        const B = nodeCenters[labels[i + 1]]
        actions.push({ type: 'draw_shape', shape: 'arrow', points: [A, B], color: undefined, width })
      }
      continue
    }

    // write "text" at (x,y) size=.. color=..
    if (/^write\b/i.test(line)) {
      const q = line.match(/"([\s\S]+?)"/)
      const text = q?.[1] || line.replace(/^write\s*/i, '')
      const at = parsePoint(kv(line, 'at') || '') || { x: 24, y: 24 }
      const size = pickSizeToken(kvNum(line, 'size'))
      const color = colorFrom(line)
      actions.push({ type: 'write_text', text, x: at.x, y: at.y, size, color })
      continue
    }

    // box "Label" at (x,y) w=.. h=.. color=..
    if (/^(box|rect|rectangle)\b/i.test(line)) {
      const q = line.match(/"([\s\S]+?)"/)
      const label = q?.[1]
      const at = parsePoint(kv(line, 'at') || '') || { x: 120, y: 140 }
      const w = kvNum(line, 'w') ?? 220
      const h = kvNum(line, 'h') ?? 120
      const color = colorFrom(line) || 'yellow'
      const width = kvNum(line, 'width') ?? 3
      actions.push({ type: 'draw_shape', shape: 'rect', points: [{ x: at.x, y: at.y }, { x: w, y: h }], color, width })
      if (label) actions.push({ type: 'write_text', text: label, x: at.x + 12, y: at.y + 12, size: pickSizeToken(22) })
      continue
    }

    // circle at (cx,cy) r=.. color=..
    if (/^circle\b/i.test(line)) {
      const at = parsePoint(kv(line, 'at') || '') || { x: 240, y: 180 }
      const r = kvNum(line, 'r') ?? 60
      const color = colorFrom(line) || 'yellow'
      const width = kvNum(line, 'width') ?? 4
      actions.push({ type: 'draw_shape', shape: 'circle', points: [{ x: at.x, y: at.y }, { x: r, y: r }], color, width })
      continue
    }

    // arrow (x1,y1) -> (x2,y2)
    if (/^arrow\b/i.test(line)) {
      const pts = line.match(/\([^\)]+\)/g)
      if (pts && pts.length >= 2) {
        const A = parsePoint(pts[0]!)
        const B = parsePoint(pts[1]!)
        if (A && B) {
          const color = colorFrom(line)
          const width = kvNum(line, 'width') ?? 3
          actions.push({ type: 'draw_shape', shape: 'arrow', points: [A, B], color, width })
        }
      }
      continue
    }

    // If the line is unrecognized, ignore it so the rest still render
  }

  return actions
}
