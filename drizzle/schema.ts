import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Artifacts ───────────────────────────────────────────────────
export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["image", "video", "audio", "document", "report"]).notNull(),
  url: text("url").notNull(),
  prompt: text("prompt"),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  metadata: text("metadata"), // JSON string
  isFavorite: int("isFavorite").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = typeof artifacts.$inferInsert;

// ── Collections ─────────────────────────────────────────────────
export const collections = mysqlTable("collections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Collection = typeof collections.$inferSelect;

export const collectionArtifacts = mysqlTable("collection_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collectionId").notNull(),
  artifactId: int("artifactId").notNull(),
});

// ── Research Tasks ──────────────────────────────────────────────
export const researchTasks = mysqlTable("research_tasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskPrompt: text("taskPrompt").notNull(),
  provider: varchar("provider", { length: 64 }),
  model: varchar("model", { length: 128 }),
  agentCount: int("agentCount").default(5),
  status: mysqlEnum("status", ["pending", "running", "complete", "error", "cancelled"]).default("pending").notNull(),
  reportUrl: text("reportUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ResearchTask = typeof researchTasks.$inferSelect;

// ── Safety Evaluations ──────────────────────────────────────────
export const safetyEvaluations = mysqlTable("safety_evaluations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  verdict: varchar("verdict", { length: 32 }),
  severity: varchar("severity", { length: 32 }),
  reasoning: text("reasoning"),
  policy: varchar("policy", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SafetyEvaluation = typeof safetyEvaluations.$inferSelect;