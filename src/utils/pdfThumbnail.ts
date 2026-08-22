// pdf.js is bundled with the app rather than pulled from a CDN at runtime, so a
// thumbnail only needs the origin the page already came from — no third party to
// be blocked by an ad blocker, a corporate proxy or a network that cannot reach
// cdnjs. A failed CDN script used to leave every PDF row showing the generic
// icon with nothing but a console error to explain it.
//
// The worker is emitted as its own asset and fetched on demand. It is not in the
// service worker precache (globPatterns in vite.config.js covers js, not mjs),
// so thumbnails still need the network on a cold cache — deliberate, since
// precaching it would add ~1.3 MB to every first install.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

const loadPdfJs = (): Promise<typeof import('pdfjs-dist')> => {
  if (pdfjsPromise) return pdfjsPromise

  pdfjsPromise = (async () => {
    const pdfjsLib = await import('pdfjs-dist')
    // Vite resolves this to a hashed asset URL and emits the worker as its own
    // file, fetched from this origin the first time a PDF is opened.
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjsLib
  })().catch((err) => {
    // Let the next call retry instead of caching the rejection forever.
    pdfjsPromise = null
    throw err
  })

  return pdfjsPromise
}

// Every pdf.js document spins up its own web worker, and each one has to parse
// the 1.3 MB worker module. A share holding ten PDFs asked for ten thumbnails
// at once on mount, so ten workers were created inside the same frame — on a
// cold load none of them ever answered pdf.js's handshake, and the thumbnails,
// plus any preview opened afterwards, sat on their spinner forever.
//
// Background thumbnails now go through a queue that runs one document at a
// time. The preview is not queued: a reader is waiting on it, so it must not
// sit behind a batch of decoration, and one preview plus one thumbnail is not
// the pile-up that caused the trouble.
const MAX_CONCURRENT_PDF_JOBS = 1

type PdfJob = () => void

const pdfQueue: PdfJob[] = []
let activePdfJobs = 0
// While a reader is waiting on a preview, no further thumbnail is started: the
// preview should not have to share the connection with decoration nobody asked
// for.
let previewJobsInFlight = 0

const pumpPdfQueue = () => {
  while (
    previewJobsInFlight === 0 &&
    activePdfJobs < MAX_CONCURRENT_PDF_JOBS &&
    pdfQueue.length > 0
  ) {
    pdfQueue.shift()?.()
  }
}

const queuePdfJob = <T>(task: () => Promise<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    pdfQueue.push(() => {
      activePdfJobs++
      task()
        .then(resolve, reject)
        .finally(() => {
          activePdfJobs--
          pumpPdfQueue()
        })
    })
    pumpPdfQueue()
  })

// A stalled worker leaves the caller waiting on a promise that may not settle
// for the best part of a minute, which the UI can only render as a spinner that
// never stops. Give up and start over instead — a second attempt runs against a
// page that has had time to settle and comes back in milliseconds.
//
// A thumbnail is one small page and has no business taking twelve seconds. The
// preview may have a dozen scanned pages to rasterise on a phone, so it gets a
// budget a slow-but-working render can still finish inside.
const THUMBNAIL_TIMEOUT_MS = 12000
const PREVIEW_TIMEOUT_MS = 30000

const withTimeout = <T>(run: () => Promise<T>, label: string, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    run(),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    })
  ]).finally(() => clearTimeout(timer)) as Promise<T>
}

const withRetry = async <T>(run: () => Promise<T>, label: string, ms: number): Promise<T> => {
  try {
    return await withTimeout(run, label, ms)
  } catch (err) {
    if (!(err instanceof Error) || !err.message.endsWith('timed out')) throw err
    // Rebuild the pdf.js setup so the retry gets a fresh worker rather than
    // queueing behind whatever the first attempt is still waiting on.
    pdfjsPromise = null
    return withTimeout(run, `${label} (retry)`, ms)
  }
}

/**
 * Generates a PNG Data URL thumbnail of the first page of a PDF.
 * @param fileOrUrl A local File object or a public URL string of a PDF file.
 * @returns A promise resolving to a PNG Data URL.
 */
export const generatePdfThumbnail = (fileOrUrl: File | string): Promise<string> =>
  queuePdfJob(() =>
    withRetry(
      async () => {
        const pdfjsLib = await loadPdfJs()

        const loadingTask =
          typeof fileOrUrl === 'string'
            ? pdfjsLib.getDocument({ url: fileOrUrl, disableRange: true, disableStream: true })
            : pdfjsLib.getDocument({
                data: new Uint8Array(await fileOrUrl.arrayBuffer()),
                disableRange: true,
                disableStream: true
              })

        const pdf = await loadingTask.promise
        const page = await pdf.getPage(1)

        // Render at a low scale for thumbnail purposes
        const viewport = page.getViewport({ scale: 0.4 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas context not available')

        canvas.height = viewport.height
        canvas.width = viewport.width

        await page.render({
          canvasContext: context,
          viewport
        }).promise

        const dataUrl = canvas.toDataURL('image/png')

        // Clean up PDF resources
        await pdf.destroy()

        return dataUrl
      },
      'PDF thumbnail',
      THUMBNAIL_TIMEOUT_MS
    ).catch((err) => {
      console.error('Failed to generate PDF thumbnail:', err)
      throw err
    })
  )

/**
 * Renders a PDF into `container` as one canvas per page, each sized to
 * `targetWidth` CSS pixels.
 *
 * The preview modal used to hand the file to an `<iframe>` and let the browser
 * draw it. Desktop Chrome has a built-in viewer so that looked fine, but iOS
 * Safari and Android Chrome refuse to render a PDF in an iframe — the recipient
 * got an empty box. Drawing the pages ourselves with the pdf.js that already
 * ships for thumbnails works the same everywhere.
 *
 * @returns the page count of the document and how many pages were drawn.
 */
export const renderPdfPages = (
  url: string,
  container: HTMLElement,
  options: { targetWidth: number; maxPages?: number; signal?: { cancelled: boolean } }
): Promise<{ pageCount: number; renderedPages: number }> =>
  // Deliberately not queued — see the note on queuePdfJob.
  withRetry(
    async () => {
      previewJobsInFlight++
      try {
        return await renderPdfPagesUnguarded(url, container, options)
      } finally {
        previewJobsInFlight--
        pumpPdfQueue()
      }
    },
    'PDF preview',
    PREVIEW_TIMEOUT_MS
  )

const renderPdfPagesUnguarded = async (
  url: string,
  container: HTMLElement,
  options: { targetWidth: number; maxPages?: number; signal?: { cancelled: boolean } }
): Promise<{ pageCount: number; renderedPages: number }> => {
  const pdfjsLib = await loadPdfJs()
  const pdf = await pdfjsLib.getDocument({ url, disableRange: true, disableStream: true }).promise

  try {
    const maxPages = options.maxPages ?? 30
    const pageCount = pdf.numPages
    const renderedPages = Math.min(pageCount, maxPages)
    // Phones are memory-tight; a device pixel ratio of 3 would triple the
    // canvas area for no visible gain at this size.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const targetWidth = Math.max(options.targetWidth, 200)

    container.innerHTML = ''

    for (let pageNumber = 1; pageNumber <= renderedPages; pageNumber++) {
      if (options.signal?.cancelled) break
      const page = await pdf.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = (targetWidth / baseViewport.width) * dpr
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas context not available')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = '100%'
      canvas.style.height = 'auto'
      canvas.style.display = 'block'
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', `PDF page ${pageNumber}`)

      await page.render({ canvasContext: context, viewport }).promise
      if (options.signal?.cancelled) break
      container.appendChild(canvas)
      page.cleanup()
    }

    return { pageCount, renderedPages }
  } finally {
    await pdf.destroy()
  }
}
