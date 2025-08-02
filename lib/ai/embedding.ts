import { embed, embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db } from '../db';
import { cosineDistance, desc, gt, sql, eq } from 'drizzle-orm';
import { embeddings } from '../db/schema/embeddings';
import { resources } from '../db/schema/resources';

const embeddingModel = openai.embedding('text-embedding-ada-002');

const generateChunks = (input: string, chunkSize: number = 1000): string[] => {
  const text = input.trim();
  
  // For shorter texts, use sentence-based chunking
  if (text.length <= chunkSize) {
    return text
      .split(/[.!?]+/)
      .map(chunk => chunk.trim())
      .filter(chunk => chunk.length > 0);
  }
  
  // For longer texts (like PDFs), use paragraph and sentence-based chunking
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      // If adding this sentence would exceed chunk size, save current chunk and start new one
      if (currentChunk.length + sentence.length + 1 > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
  }
  
  return chunks.filter(chunk => chunk.length > 0);
};

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replaceAll('\\n', ' ');
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

export const findRelevantContent = async (userQuery: string) => {
  const userQueryEmbedded = await generateEmbedding(userQuery);
  const similarity = sql<number>`1 - (${cosineDistance(
    embeddings.embedding,
    userQueryEmbedded,
  )})`;
  const similarGuides = await db
    .select({ 
      content: embeddings.content, 
      similarity,
      resourceId: embeddings.resourceId,
      fileName: resources.fileName,
      fileType: resources.fileType
    })
    .from(embeddings)
    .leftJoin(resources, eq(embeddings.resourceId, resources.id))
    .where(gt(similarity, 0.5))
    .orderBy(t => desc(t.similarity))
    .limit(4);
  return similarGuides;
};