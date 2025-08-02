import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF, cleanPDFText } from '@/lib/ai/pdf-processor';
import { createPdfResource } from '@/lib/actions/resources';

export async function POST(request: NextRequest) {
  console.log('PDF upload endpoint called');
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    console.log('File received:', file?.name, file?.size, file?.type);
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }
    
    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const { text, metadata } = await extractTextFromPDF(buffer, file.name);
    console.log('PDF text extracted, length:', text.length);
    
    // Clean the extracted text
    const cleanedText = cleanPDFText(text);
    
    if (cleanedText.length === 0) {
      return NextResponse.json(
        { error: 'No readable text found in PDF' },
        { status: 400 }
      );
    }
    
    // Create resource with embeddings
    const result = await createPdfResource({
      content: cleanedText,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size.toString(),
    });
    
    return NextResponse.json({
      message: 'PDF uploaded and processed successfully',
      result,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        pageCount: metadata.pageCount,
        title: metadata.title,
      },
    });
    
  } catch (error) {
    console.error('PDF upload error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: error instanceof Error 
          ? error.message 
          : 'Failed to process PDF' 
      },
      { status: 500 }
    );
  }
}