// ============================================================
// Artifacts Router — CRUD for generated content (images, videos, audio, etc.)
// ============================================================

import { z } from 'zod';
import { eq, desc, like, and, sql } from 'drizzle-orm';
import { publicProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { artifacts, collectionArtifacts } from '../../drizzle/schema';

export const artifactsRouter = router({
  save: publicProcedure
    .input(z.object({
      type: z.enum(['image', 'video', 'audio', 'document', 'report']),
      url: z.string(),
      prompt: z.string().optional(),
      provider: z.string().optional(),
      model: z.string().optional(),
      metadata: z.string().optional(), // JSON string
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const userId = ctx.user?.id ?? 0;
      const [result] = await db.insert(artifacts).values({
        userId,
        type: input.type,
        url: input.url,
        prompt: input.prompt ?? null,
        provider: input.provider ?? null,
        model: input.model ?? null,
        metadata: input.metadata ?? null,
      }).$returningId();
      return { id: result.id };
    }),

  list: publicProcedure
    .input(z.object({
      type: z.enum(['image', 'video', 'audio', 'document', 'report']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      search: z.string().optional(),
      favoritesOnly: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [];
      if (input.type) conditions.push(eq(artifacts.type, input.type));
      if (input.favoritesOnly) conditions.push(eq(artifacts.isFavorite, 1));
      if (input.search) {
        const escaped = input.search.replace(/[%_\\]/g, '\\$&');
        conditions.push(like(artifacts.prompt, `%${escaped}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db.select()
          .from(artifacts)
          .where(where)
          .orderBy(desc(artifacts.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db.select({ count: sql<number>`count(*)` })
          .from(artifacts)
          .where(where),
      ]);

      return { items, total: countResult[0]?.count ?? 0 };
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(artifacts).where(eq(artifacts.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      // Remove from collections first
      await db.delete(collectionArtifacts).where(eq(collectionArtifacts.artifactId, input.id));
      await db.delete(artifacts).where(eq(artifacts.id, input.id));
      return { success: true };
    }),

  toggleFavorite: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      // Toggle by flipping the value
      await db.update(artifacts)
        .set({ isFavorite: sql`IF(${artifacts.isFavorite} = 1, 0, 1)` })
        .where(eq(artifacts.id, input.id));
      const rows = await db.select({ isFavorite: artifacts.isFavorite })
        .from(artifacts).where(eq(artifacts.id, input.id)).limit(1);
      return { isFavorite: rows[0]?.isFavorite === 1 };
    }),

  favorites: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select()
        .from(artifacts)
        .where(eq(artifacts.isFavorite, 1))
        .orderBy(desc(artifacts.createdAt))
        .limit(input.limit);
    }),
});
