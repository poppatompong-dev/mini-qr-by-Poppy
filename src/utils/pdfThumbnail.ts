let pdfjsPromise: Promise<any> | null = null

const loadPdfJs = (): Promise<any> => {
  if (pdfjsPromise) return pdfjsPromise

  pdfjsPromise = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib
      // Configure worker from CDN
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(pdfjsLib)
    }
    script.onerror = (err) => {
      pdfjsPromise = null
      reject(err)
    }
    document.head.appendChild(script)
  })

  return pdfjsPromise
}

/**
 * Generates a PNG Data URL thumbnail of the first page of a PDF.
 * @param fileOrUrl A local File object or a public URL string of a PDF file.
 * @returns A promise resolving to a PNG Data URL.
 */
export const generatePdfThumbnail = async (fileOrUrl: File | string): Promise<string> => {
  try {
    const pdfjsLib = await loadPdfJs()
    let pdfData: any

    if (typeof fileOrUrl === 'string') {
      pdfData = fileOrUrl
    } else {
      const arrayBuffer = await fileOrUrl.arrayBuffer()
      pdfData = new Uint8Array(arrayBuffer)
    }

    const loadingTask = pdfjsLib.getDocument({
      data: typeof pdfData === 'string' ? undefined : pdfData,
      url: typeof pdfData === 'string' ? pdfData : undefined,
      // Disable range requests/stream for smoother loading of remote/local files
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
      viewport: viewport
    }).promise

    const dataUrl = canvas.toDataURL('image/png')
    
    // Clean up PDF resources
    await pdf.destroy()
    
    return dataUrl
  } catch (err) {
    console.error('Failed to generate PDF thumbnail:', err)
    throw err
  }
}
