// ============================================================
// Prompts Router — Save/load reusable prompt templates
// ============================================================

import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { publicProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { savedPrompts } from '../../drizzle/schema';

export const promptsRouter = router({
  save: publicProcedure
    .input(z.object({
      category: z.string().min(1).max(64),
      name: z.string().min(1).max(256),
      prompt: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      const userId = ctx.user?.id ?? 0;
      const [result] = await db.insert(savedPrompts).values({
        userId,
        category: input.category,
        name: input.name,
        prompt: input.prompt,
      }).$returningId();
      return { id: result.id };
    }),

  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const userId = ctx.user?.id ?? 0;
      const conditions = [eq(savedPrompts.userId, userId)];
      if (input.category) conditions.push(eq(savedPrompts.category, input.category));
      return db.select()
        .from(savedPrompts)
        .where(and(...conditions))
        .orderBy(desc(savedPrompts.createdAt));
    }),

  use: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.update(savedPrompts)
        .set({ useCount: sql`${savedPrompts.useCount} + 1` })
        .where(eq(savedPrompts.id, input.id));
      const rows = await db.select().from(savedPrompts).where(eq(savedPrompts.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');
      await db.delete(savedPrompts).where(eq(savedPrompts.id, input.id));
      return { success: true };
    }),
});
