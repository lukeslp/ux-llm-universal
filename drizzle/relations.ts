import { relations } from "drizzle-orm";
import {
  users, artifacts, collections, collectionArtifacts,
  savedPrompts, usageLog, rewriteRules, researchTasks, safetyEvaluations,
} from "./schema";

// ── User Relations ──────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  artifacts: many(artifacts),
  collections: many(collections),
  savedPrompts: many(savedPrompts),
  usageLog: many(usageLog),
  rewriteRules: many(rewriteRules),
  researchTasks: many(researchTasks),
  safetyEvaluations: many(safetyEvaluations),
}));

// ── Artifact Relations ──────────────────────────────────────────
export const artifactsRelations = relations(artifacts, ({ one, many }) => ({
  user: one(users, { fields: [artifacts.userId], references: [users.id] }),
  collectionLinks: many(collectionArtifacts),
}));

// ── Collection Relations ────────────────────────────────────────
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(users, { fields: [collections.userId], references: [users.id] }),
  items: many(collectionArtifacts),
}));

export const collectionArtifactsRelations = relations(collectionArtifacts, ({ one }) => ({
  collection: one(collections, { fields: [collectionArtifacts.collectionId], references: [collections.id] }),
  artifact: one(artifacts, { fields: [collectionArtifacts.artifactId], references: [artifacts.id] }),
}));

// ── Saved Prompts Relations ─────────────────────────────────────
export const savedPromptsRelations = relations(savedPrompts, ({ one }) => ({
  user: one(users, { fields: [savedPrompts.userId], references: [users.id] }),
}));

// ── Usage Log Relations ─────────────────────────────────────────
export const usageLogRelations = relations(usageLog, ({ one }) => ({
  user: one(users, { fields: [usageLog.userId], references: [users.id] }),
}));

// ── Rewrite Rules Relations ─────────────────────────────────────
export const rewriteRulesRelations = relations(rewriteRules, ({ one }) => ({
  user: one(users, { fields: [rewriteRules.userId], references: [users.id] }),
}));

// ── Research Tasks Relations ────────────────────────────────────
export const researchTasksRelations = relations(researchTasks, ({ one }) => ({
  user: one(users, { fields: [researchTasks.userId], references: [users.id] }),
}));

// ── Safety Evaluations Relations ────────────────────────────────
export const safetyEvaluationsRelations = relations(safetyEvaluations, ({ one }) => ({
  user: one(users, { fields: [safetyEvaluations.userId], references: [users.id] }),
}));
