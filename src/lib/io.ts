import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import monoLatin from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url'
import type { Rect, Scene } from '../types'

const PAPER = '#fbfbfa'

let fontCss: string | null = null

async function embeddedFontCss(): Promise<string> {
  if (fontCss !== null) return fontCss
  const load = async (url: string) => {
    const res = await fetch(url)
    const buf = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    const chunk = 0x8000
    for (let i = 0; i < buf.length; i += chunk) {
      bin += String.fromCharCode(...buf.subarray(i, i + chunk))
    }
    return btoa(bin)
  }
  try {
    const [inter, mono] = await Promise.all([load(interLatin), load(monoLatin)])
    fontCss = `
@font-face{font-family:'Inter Variable';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${inter}) format('woff2');}
@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${mono}) format('woff2');}
`
  } catch {
    fontCss = ''
  }
  return fontCss
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const slugify = (s: string) =>
  (s.trim() || 'diagram')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'diagram'

/** Clone the live canvas, strip UI chrome and reframe it around the content. */
export async function buildSvg(
  live: SVGSVGElement,
  bounds: Rect,
  opts: { transparent?: boolean; margin?: number } = {},
): Promise<string> {
  const margin = opts.margin ?? 40
  const b = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    w: Math.max(1, bounds.w + margin * 2),
    h: Math.max(1, bounds.h + margin * 2),
  }
  const clone = live.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll('[data-export="false"]').forEach((el) => el.remove())
  clone.querySelectorAll('defs').forEach((el) => el.remove())

  // Drop the pan/zoom transform — the viewBox does the framing instead.
  const root = clone.querySelector('g[transform]')
  if (root) root.removeAttribute('transform')

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(Math.round(b.w)))
  clone.setAttribute('height', String(Math.round(b.h)))
  clone.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`)

  const css = await embeddedFontCss()
  const bg = opts.transparent
    ? ''
    : `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${PAPER}"/>`
  const inner = clone.innerHTML
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(b.w)}" height="${Math.round(
    b.h,
  )}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}"><style>${css}</style>${bg}${inner}</svg>`
}

export async function exportSvgFile(live: SVGSVGElement, bounds: Rect, name: string) {
  const svg = await buildSvg(live, bounds)
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${slugify(name)}.svg`)
}

export async function exportPngFile(
  live: SVGSVGElement,
  bounds: Rect,
  name: string,
  scale = 2,
  transparent = false,
) {
  const svg = await buildSvg(live, bounds, { transparent })
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('render failed'))
      img.src = url
    })
    const w = Math.round((bounds.w + 80) * scale)
    const h = Math.round((bounds.h + 80) * scale)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, w)
    canvas.height = Math.max(1, h)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (out) download(out, `${slugify(name)}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function saveSceneFile(scene: Scene) {
  const payload = JSON.stringify({ format: 'vellum', version: 1, ...scene }, null, 2)
  download(new Blob([payload], { type: 'application/json' }), `${slugify(scene.title)}.vellum.json`)
}

export function openSceneFile(): Promise<Scene | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.vellum,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      try {
        const parsed = JSON.parse(await file.text())
        if (!parsed || !Array.isArray(parsed.nodes)) return resolve(null)
        resolve({
          title: parsed.title ?? file.name.replace(/\.(vellum\.)?json$/, ''),
          nodes: parsed.nodes,
          edges: parsed.edges ?? [],
          ink: parsed.ink ?? [],
        })
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}
