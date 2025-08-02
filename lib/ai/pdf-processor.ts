import * as pdfjs from 'pdfjs-dist';

// Set the worker source for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface PDFProcessingResult {
  text: string;
  metadata: {
    title?: string;
    author?: string;
    pageCount: number;
    fileSize: number;
  };
}

export async function extractTextFromPDF(
  buffer: Buffer,
  fileName: string
): Promise<PDFProcessingResult> {
  try {
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const numPages = pdf.numPages;
    let text = '';
    
    // Extract text from all pages
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      text += pageText + '\n';
    }
    
    // Get metadata
    const metadata = await pdf.getMetadata();
    
    return {
      text: text.trim(),
      metadata: {
        title: (metadata.info as any)?.Title || fileName,
        author: (metadata.info as any)?.Author,
        pageCount: numPages,
        fileSize: buffer.length,
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function cleanPDFText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page numbers and headers/footers (common patterns)
    .replace(/^\d+\s*$/gm, '')
    // Remove multiple line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}