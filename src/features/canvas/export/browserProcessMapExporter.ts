import type { GraphDocument } from '../canvasTypes'
import type { SharedElementLibrary } from '../sharedElements'
import {
  createFlowentMapBackup,
  exportProcessMap,
  exportProcessMapAsSvg,
  getExportFileSpec,
  type ProcessMapExportFormat,
} from './processMapExporter'

const RASTER_SCALE = 2
const MAX_RASTER_DIMENSION = 8192
const MAX_RASTER_PIXELS = 64_000_000

export type BrowserExportResult = {
  blob: Blob
  filename: string
}

export async function createBrowserExport(
  doc: GraphDocument,
  format: ProcessMapExportFormat,
  options: { mapName?: string; elementLibrary?: SharedElementLibrary } = {},
): Promise<BrowserExportResult> {
  const spec = getExportFileSpec(format)
  const filename = createExportFilename(options.mapName ?? doc.id, spec.extension)

  if (format === 'json') {
    const backup = createFlowentMapBackup(doc, options.elementLibrary)
    return {
      blob: new Blob([JSON.stringify(backup, null, 2)], { type: spec.mimeType }),
      filename,
    }
  }

  const svg = exportProcessMapAsSvg(doc)
  if (format === 'svg') {
    return { blob: new Blob([svg], { type: spec.mimeType }), filename }
  }

  if (format === 'png' || format === 'jpg') {
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    return { blob: await renderSvgAsRaster(svg, doc, mimeType), filename }
  }

  return { blob: await renderSvgAsPdf(svg, doc), filename }
}

export function createExportFilename(mapName: string, extension: string, timestamp = new Date()): string {
  const stem = mapName
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'process-map'
  const date = timestamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '')
  return `flowent-${stem}-${date}.${extension}`
}

async function renderSvgAsRaster(svg: string, doc: GraphDocument, mimeType: 'image/png' | 'image/jpeg'): Promise<Blob> {
  const { width, height } = exportProcessMap(doc)
  const rasterWidth = Math.ceil(width * RASTER_SCALE)
  const rasterHeight = Math.ceil(height * RASTER_SCALE)
  if (
    rasterWidth > MAX_RASTER_DIMENSION ||
    rasterHeight > MAX_RASTER_DIMENSION ||
    rasterWidth * rasterHeight > MAX_RASTER_PIXELS
  ) {
    throw new Error('This map is too large to export as a raster image. Export SVG or PDF instead.')
  }

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = rasterWidth
    canvas.height = rasterHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not create an image export canvas.')
    context.drawImage(image, 0, 0, rasterWidth, rasterHeight)
    return await canvasToBlob(canvas, mimeType, mimeType === 'image/jpeg' ? 0.92 : undefined)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function renderSvgAsPdf(svg: string, doc: GraphDocument): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
  ])
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const svgElement = parsed.documentElement
  if (svgElement.nodeName.toLowerCase() !== 'svg') throw new Error('Flowent could not prepare this map for PDF export.')

  const { width, height } = exportProcessMap(doc)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const scale = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height)
  const renderWidth = width * scale
  const renderHeight = height * scale

  await svg2pdf(svgElement, pdf, {
    x: (pageWidth - renderWidth) / 2,
    y: (pageHeight - renderHeight) / 2,
    width: renderWidth,
    height: renderHeight,
  })
  return pdf.output('blob')
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Flowent could not render this map as an image.'))
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Flowent could not create the image export.'))
    }, mimeType, quality)
  })
}
