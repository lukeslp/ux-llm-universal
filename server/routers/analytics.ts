// ============================================================
// Analytics Router — Usage logging and summary queries
// ============================================================

import { z } from 'zod';
import { desc, sql, gte } from 'drizzle-orm';
import { publicProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { usageLog } from '../../drizzle/schema';

export const analyticsRouter = router({
  log: publicProcedure
    .input(z.object({
      feature: z.string(),
      model: z.string().optional(),
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      itemCount: z.number().optional(),
      success: z.boolean().default(true),
      errorMessage: z.string().optional(),
      durationMs: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { logged: false };
      const userId = ctx.user?.id ?? null;
      await db.insert(usageLog).values({
        userId,
        feature: input.feature,
        model: input.model ?? null,
        promptTokens: input.promptTokens ?? null,
        completionTokens: input.completionTokens ?? null,
        itemCount: input.itemCount ?? 1,
        success: input.success ? 1 : 0,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
      });
      return { logged: true };
    }),

  summary: publicProcedure
    .input(z.object({ daysBack: z.number().min(1).max(365).default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { features: [], totalRequests: 0 };
      const since = new Date(Date.now() - input.daysBack * 86400000);
      const rows = await db.select({
        feature: usageLog.feature,
        count: sql<number>`count(*)`,
        successCount: sql<number>`SUM(${usageLog.success})`,
        avgDuration: sql<number>`AVG(${usageLog.durationMs})`,
      })
        .from(usageLog)
        .where(gte(usageLog.createdAt, since))
        .groupBy(usageLog.feature);

      return {
        features: rows,
        totalRequests: rows.reduce((sum, r) => sum + (r.count || 0), 0),
      };
    }),

  recent: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select()
        .from(usageLog)
        .orderBy(desc(usageLog.createdAt))
        .limit(input.limit);
    }),
});
