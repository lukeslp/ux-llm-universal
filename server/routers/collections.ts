// ============================================================
// Collections Router — Group artifacts into named collections
// ============================================================

import { z } from 'zod';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { publicProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { collections, collectionArtifacts, artifacts } from '../../drizzle/schema';

export const collectionsRouter = router({
  list: publicProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const userId = ctx.user?.id ?? 0;
      return db.select()
        .from(collections)
        .where(eq(collections.userId, userId))
        .orderBy(desc(collections.createdAt));
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(256),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const userId = ctx.user?.id ?? 0;
      const [result] = await db.insert(collections).values({
        userId,
        name: input.name,
        description: input.description ?? null,
      }).$returningId();
      return { id: result.id };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(256).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (Object.keys(updates).length > 0) {
        await db.update(collections).set(updates).where(eq(collections.id, input.id));
      }
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(collectionArtifacts).where(eq(collectionArtifacts.collectionId, input.id));
      await db.delete(collections).where(eq(collections.id, input.id));
      return { success: true };
    }),

  addItem: publicProcedure
    .input(z.object({ collectionId: z.number(), artifactId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.insert(collectionArtifacts).values({
        collectionId: input.collectionId,
        artifactId: input.artifactId,
      });
      return { success: true };
    }),

  removeItem: publicProcedure
    .input(z.object({ collectionId: z.number(), artifactId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(collectionArtifacts)
        .where(and(
          eq(collectionArtifacts.collectionId, input.collectionId),
          eq(collectionArtifacts.artifactId, input.artifactId),
        ));
      return { success: true };
    }),

  items: publicProcedure
    .input(z.object({ collectionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const links = await db.select({ artifactId: collectionArtifacts.artifactId })
        .from(collectionArtifacts)
        .where(eq(collectionArtifacts.collectionId, input.collectionId));
      if (links.length === 0) return [];
      const ids = links.map(l => l.artifactId);
      return db.select().from(artifacts).where(inArray(artifacts.id, ids));
    }),
});
