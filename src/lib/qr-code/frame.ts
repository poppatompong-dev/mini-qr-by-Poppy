import { escapeAttr, escapeText, renderQrFragment, wrapAsSvg } from './render/svg'
import type { FrameConfig, ResolvedQRCodeConfig } from './types'

const DEFAULT_FRAME: Required<
  Omit<
    FrameConfig,
    | 'text'
    | 'textPosition'
    | 'textTop'
    | 'textBottom'
    | 'textColorTop'
    | 'textColorBottom'
    | 'fontSizeTop'
    | 'fontSizeBottom'
    | 'fontWeightTop'
    | 'fontWeightBottom'
    | 'fontStyleTop'
    | 'fontStyleBottom'
    | 'fontFamilyTop'
    | 'fontFamilyBottom'
  >
> = {
  textColor: '#000000',
  backgroundColor: '#ffffff',
  borderColor: '#000000',
  borderWidth: 2,
  borderRadius: 8,
  padding: 12,
  fontFamily: 'sans-serif',
  fontSize: 18,
  captionWidth: 0, // 0 = auto: side caption column defaults to the QR size
  backgroundImage: '' // '' = none
}

export interface FramedSvg {
  svg: string
  width: number
  height: number
  matrixCount: number
}

/**
 * Compose a frame (border + caption) around the QR fragment. Output is a
 * single SVG element so SVG-to-canvas rasterisation stays flat and
 * cross-browser safe.
 */
export function renderFramed(config: ResolvedQRCodeConfig): FramedSvg {
  const { fragment, size, matrixCount } = renderQrFragment(config)
  if (!config.frame) {
    return { svg: wrapAsSvg(fragment, size, size), width: size, height: size, matrixCount }
  }

  const f = { ...DEFAULT_FRAME, ...config.frame }
  
  const resolvedTextTop = (typeof f.textTop === 'string' && f.textTop.trim() !== '')
    ? f.textTop
    : (f.textPosition === 'top' && typeof f.text === 'string' && f.text.trim() !== '') ? f.text : ''

  const resolvedTextBottom = (typeof f.textBottom === 'string' && f.textBottom.trim() !== '')
    ? f.textBottom
    : (f.textPosition === 'bottom' && typeof f.text === 'string' && f.text.trim() !== '') ? f.text : ''

  const hasTop = resolvedTextTop !== ''
  const hasBottom = resolvedTextBottom !== ''

  let outerW: number
  let outerH: number
  let qrX: number
  let qrY: number
  let textNodes = ''

  const padding = f.padding
  const bw = f.borderWidth

  if (hasTop || hasBottom) {
    const fontSizeTop = f.fontSizeTop || f.fontSize
    const fontSizeBottom = f.fontSizeBottom || f.fontSize
    const textColorTop = f.textColorTop || f.textColor
    const textColorBottom = f.textColorBottom || f.textColor
    const fontWeightTop = f.fontWeightTop || 'normal'
    const fontWeightBottom = f.fontWeightBottom || 'normal'
    const fontStyleTop = f.fontStyleTop || 'normal'
    const fontStyleBottom = f.fontStyleBottom || 'normal'
    const fontFamilyTop = f.fontFamilyTop || f.fontFamily
    const fontFamilyBottom = f.fontFamilyBottom || f.fontFamily

    const topLines = hasTop ? wrapLines(resolvedTextTop, fontSizeTop, size) : []
    const bottomLines = hasBottom ? wrapLines(resolvedTextBottom, fontSizeBottom, size) : []

    const lineHeightTop = fontSizeTop * 1.2
    const lineHeightBottom = fontSizeBottom * 1.2

    const textBlockTopHeight = hasTop ? lineHeightTop * topLines.length : 0
    const textBlockBottomHeight = hasBottom ? lineHeightBottom * bottomLines.length : 0

    outerW = size + 2 * padding + 2 * bw
    outerH = size + 2 * padding + 2 * bw + (hasTop ? textBlockTopHeight + padding : 0) + (hasBottom ? textBlockBottomHeight + padding : 0)
    qrX = padding + bw
    qrY = padding + bw + (hasTop ? textBlockTopHeight + padding : 0)

    const textXVal = outerW / 2
    const textTopY = padding + bw + fontSizeTop
    const textBottomY = qrY + size + padding + fontSizeBottom

    if (hasTop) {
      textNodes +=
        `<text x="${textXVal}" y="${textTopY}" font-family="${escapeAttr(fontFamilyTop)}" ` +
        `font-size="${fontSizeTop}" font-weight="${escapeAttr(fontWeightTop)}" font-style="${escapeAttr(fontStyleTop)}" ` +
        `fill="${escapeAttr(textColorTop)}" text-anchor="middle">` +
        topLines
          .map(
            (line, i) =>
              `<tspan x="${textXVal}" dy="${i === 0 ? 0 : lineHeightTop}">${escapeText(line)}</tspan>`
          )
          .join('') +
        `</text>`
    }
    if (hasBottom) {
      textNodes +=
        `<text x="${textXVal}" y="${textBottomY}" font-family="${escapeAttr(fontFamilyBottom)}" ` +
        `font-size="${fontSizeBottom}" font-weight="${escapeAttr(fontWeightBottom)}" font-style="${escapeAttr(fontStyleBottom)}" ` +
        `fill="${escapeAttr(textColorBottom)}" text-anchor="middle">` +
        bottomLines
          .map(
            (line, i) =>
              `<tspan x="${textXVal}" dy="${i === 0 ? 0 : lineHeightBottom}">${escapeText(line)}</tspan>`
          )
          .join('') +
        `</text>`
    }
  } else {
    // Legacy single-text rendering path
    const isSide = f.textPosition === 'left' || f.textPosition === 'right'
    const captionWidth = f.captionWidth > 0 ? f.captionWidth : size
    const wrapWidth = isSide ? captionWidth : size
    const lines = wrapLines(f.text, f.fontSize, wrapWidth)
    const lineHeight = f.fontSize * 1.2
    const textBlockHeight = lineHeight * lines.length
    const widestLine = approxTextWidth(lines, f.fontSize)
    const textBlockWidth = isSide ? wrapWidth : Math.max(widestLine, f.fontSize)

    const sideOuterH = Math.max(size, textBlockHeight) + 2 * padding + 2 * bw
    const sideQrY = (sideOuterH - size) / 2

    let textX: number
    let textY: number
    let textAnchor: 'start' | 'middle' | 'end'

    switch (f.textPosition) {
      case 'top':
        outerW = size + 2 * padding + 2 * bw
        outerH = size + textBlockHeight + 3 * padding + 2 * bw
        qrX = padding + bw
        qrY = textBlockHeight + 2 * padding + bw
        textX = outerW / 2
        textY = padding + bw + f.fontSize
        textAnchor = 'middle'
        break
      case 'bottom':
        outerW = size + 2 * padding + 2 * bw
        outerH = size + textBlockHeight + 3 * padding + 2 * bw
        qrX = padding + bw
        qrY = padding + bw
        textX = outerW / 2
        textY = size + 2 * padding + bw + f.fontSize
        textAnchor = 'middle'
        break
      case 'left':
        outerW = size + textBlockWidth + 3 * padding + 2 * bw
        outerH = sideOuterH
        qrX = textBlockWidth + 2 * padding + bw
        qrY = sideQrY
        textX = padding + bw + textBlockWidth / 2
        textY = (outerH - textBlockHeight) / 2 + f.fontSize
        textAnchor = 'middle'
        break
      case 'right':
        outerW = size + textBlockWidth + 3 * padding + 2 * bw
        outerH = sideOuterH
        qrX = padding + bw
        qrY = sideQrY
        textX = size + 2 * padding + bw + textBlockWidth / 2
        textY = (outerH - textBlockHeight) / 2 + f.fontSize
        textAnchor = 'middle'
        break
    }

    textNodes =
      `<text x="${textX}" y="${textY}" font-family="${escapeAttr(f.fontFamily)}" ` +
      `font-size="${f.fontSize}" fill="${escapeAttr(f.textColor)}" text-anchor="${textAnchor}">` +
      lines
        .map(
          (line, i) =>
            `<tspan x="${textX}" dy="${i === 0 ? 0 : lineHeight}">${escapeText(line)}</tspan>`
        )
        .join('') +
      `</text>`
  }

  const halfBorder = f.borderWidth / 2
  const borderRect =
    `<rect x="${halfBorder}" y="${halfBorder}" width="${outerW - f.borderWidth}" ` +
    `height="${outerH - f.borderWidth}" rx="${f.borderRadius}" ry="${f.borderRadius}" ` +
    `fill="${escapeAttr(f.backgroundColor)}" stroke="${escapeAttr(f.borderColor)}" ` +
    `stroke-width="${f.borderWidth}"/>`

  // Background image: cover the whole frame (CSS background-size: cover
  // equivalent), clipped to the border radius like the preview's overflow.
  // The border stroke is re-painted on top so a full-bleed image can't cover
  // its inner half.
  let backgroundImageNodes = ''
  if (f.backgroundImage) {
    const clipId = 'frame-bg-clip'
    backgroundImageNodes =
      `<defs><clipPath id="${clipId}">` +
      `<rect x="0" y="0" width="${outerW}" height="${outerH}" rx="${f.borderRadius}" ry="${f.borderRadius}"/>` +
      `</clipPath></defs>` +
      `<image href="${escapeAttr(f.backgroundImage)}" x="0" y="0" width="${outerW}" ` +
      `height="${outerH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>` +
      `<rect x="${halfBorder}" y="${halfBorder}" width="${outerW - f.borderWidth}" ` +
      `height="${outerH - f.borderWidth}" rx="${f.borderRadius}" ry="${f.borderRadius}" ` +
      `fill="none" stroke="${escapeAttr(f.borderColor)}" stroke-width="${f.borderWidth}"/>`
  }

  // Lift the <image> (centre logo) out of the QR group with its x/y rewritten
  // to absolute viewBox coordinates.
  const { fragment: qrInnerFragment, image: liftedImage } = liftImage(fragment, qrX, qrY)
  const qrGroup = `<g transform="translate(${qrX}, ${qrY})">${qrInnerFragment}</g>`

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${outerW} ${outerH}" width="${outerW}" height="${outerH}">` +
    borderRect +
    backgroundImageNodes +
    qrGroup +
    liftedImage +
    textNodes +
    `</svg>`

  return { svg, width: outerW, height: outerH, matrixCount }
}

function liftImage(fragment: string, dx: number, dy: number): { fragment: string; image: string } {
  const match = fragment.match(/<image\b[^>]*\/>/)
  if (!match) return { fragment, image: '' }
  const adjusted = match[0]
    .replace(/\bx="([\d.]+)"/, (_, v) => `x="${parseFloat(v) + dx}"`)
    .replace(/\by="([\d.]+)"/, (_, v) => `y="${parseFloat(v) + dy}"`)
  return {
    fragment: fragment.replace(match[0], ''),
    image: adjusted
  }
}

/**
 * Greedy word-wrap using the same char-width heuristic as approxTextWidth.
 * Explicit newlines are preserved (including blank lines); a single word
 * wider than the column gets its own line rather than being broken mid-word —
 * matching how the preview's CSS column treats unbreakable words.
 */
function wrapLines(text: string, fontSize: number, maxWidth: number): string[] {
  const charWidth = fontSize * 0.6
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ').filter((w) => w.length > 0)
    if (words.length === 0) {
      out.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (line && candidate.length * charWidth > maxWidth) {
        out.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    out.push(line)
  }
  return out
}

function approxTextWidth(lines: string[], fontSize: number): number {
  let widest = 0
  for (const line of lines) {
    // Rough heuristic: width = chars * 0.6 * fontSize. Fine for layout sizing;
    // the SVG renderer kerns the real glyphs at draw time.
    const w = line.length * fontSize * 0.6
    if (w > widest) widest = w
  }
  return widest
}
