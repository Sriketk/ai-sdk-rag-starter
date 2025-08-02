'use server';

import {
  NewResourceParams,
  insertResourceSchema,
  resources,
} from '@/lib/db/schema/resources';
import { z } from 'zod';
import { db } from '../db';
import { generateEmbeddings } from '../ai/embedding';
import { embeddings as embeddingsTable } from '../db/schema/embeddings';
import { desc, eq, sql } from 'drizzle-orm';

export const createResource = async (input: NewResourceParams) => {
  try {
    const { content } = insertResourceSchema.parse(input);

    const [resource] = await db
      .insert(resources)
      .values({ content })
      .returning();

    const embeddings = await generateEmbeddings(content);
    await db.insert(embeddingsTable).values(
      embeddings.map(embedding => ({
        resourceId: resource.id,
        ...embedding,
      })),
    );

    return 'Resource successfully created and embedded.';
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error, please try again.';
  }
};

// Schema for PDF resources
const pdfResourceSchema = z.object({
  content: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.string(),
});

export type PdfResourceParams = z.infer<typeof pdfResourceSchema>;

export const createPdfResource = async (input: PdfResourceParams) => {
  try {
    const { content, fileName, fileType, fileSize } = pdfResourceSchema.parse(input);

    const [resource] = await db
      .insert(resources)
      .values({ 
        content,
        fileName,
        fileType,
        fileSize,
      })
      .returning();

    const embeddings = await generateEmbeddings(content);
    await db.insert(embeddingsTable).values(
      embeddings.map(embedding => ({
        resourceId: resource.id,
        ...embedding,
      })),
    );

    return `PDF "${fileName}" successfully processed and embedded.`;
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error processing PDF, please try again.';
  }
};

export const getResources = async () => {
  try {
    const resourceList = await db
      .select({
        id: resources.id,
        fileName: resources.fileName,
        fileType: resources.fileType,
        fileSize: resources.fileSize,
        createdAt: resources.createdAt,
      })
      .from(resources)
      .where(sql`${resources.fileName} IS NOT NULL`)
      .orderBy(desc(resources.createdAt));
    
    return resourceList;
  } catch (error) {
    console.error('Error fetching resources:', error);
    return [];
  }
};

export const deleteResource = async (resourceId: string) => {
  try {
    // First delete related embeddings
    await db.delete(embeddingsTable).where(eq(embeddingsTable.resourceId, resourceId));
    
    // Then delete the resource
    const [deletedResource] = await db
      .delete(resources)
      .where(eq(resources.id, resourceId))
      .returning({ fileName: resources.fileName });
    
    return `Successfully deleted "${deletedResource?.fileName || 'resource'}".`;
  } catch (error) {
    return error instanceof Error && error.message.length > 0
      ? error.message
      : 'Error deleting resource, please try again.';
  }
};