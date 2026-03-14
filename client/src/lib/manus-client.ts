// ============================================================
// Manus API Client — Task-based async agent
// All requests go through /api/manus/* — no keys in browser
// Manus is NOT a chat API — it's an async task agent
// ============================================================

import { apiUrl } from './api-base';
import type { ManusTask, ManusTaskStatus, ManusArtifact, ManusStep } from './types';

// Re-export types for convenience
export type { ManusTask, ManusTaskStatus, ManusArtifact, ManusStep };

export interface CreateManusTaskOptions {
  prompt: string;
  model: string;
  files?: string[];
}

export async function createManusTask(options: CreateManusTaskOptions): Promise<{ taskId: string }> {
  const res = await fetch(apiUrl('/api/manus/tasks'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: options.prompt,
      model: options.model,
      files: options.files,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `Failed to create task (${res.status})`);
  }

  const data = await res.json();
  // Handle various response shapes from Manus API
  const taskId = data.task_id || data.id || data.taskId;
  if (!taskId) throw new Error('No task ID in response');
  return { taskId };
}

export async function getManusTaskStatus(taskId: string): Promise<ManusTask> {
  const res = await fetch(apiUrl(`/api/manus/tasks/${encodeURIComponent(taskId)}`), {
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `Failed to fetch task (${res.status})`);
  }

  const data = await res.json();
  return normalizeManusTask(taskId, data);
}

export async function cancelManusTask(taskId: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/manus/tasks/${encodeURIComponent(taskId)}/cancel`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `Failed to cancel task (${res.status})`);
  }
}

export async function uploadManusFile(file: File): Promise<{ fileId: string }> {
  const res = await fetch(apiUrl('/api/manus/files'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `Failed to upload file (${res.status})`);
  }

  const data = await res.json();
  const fileId = data.file_id || data.id || data.fileId;
  if (!fileId) throw new Error('No file ID in response');
  return { fileId };
}

// Normalize various Manus API response shapes into our ManusTask type
function normalizeManusTask(taskId: string, data: Record<string, unknown>): ManusTask {
  const status = normalizeStatus(String(data.status || 'pending'));

  // Extract steps from various possible API shapes
  const rawSteps = (data.steps as Array<Record<string, unknown>> | undefined) || [];
  const steps: ManusStep[] = rawSteps.map((s) => ({
    label: String(s.label || s.name || s.description || 'Processing'),
    status: normalizeStepStatus(String(s.status || 'pending')),
    timestamp: Number(s.timestamp || s.created_at || Date.now()),
    detail: s.detail ? String(s.detail) : undefined,
  }));

  // Extract artifacts
  const rawArtifacts = (data.artifacts as Array<Record<string, unknown>> | undefined) || [];
  const artifacts: ManusArtifact[] = rawArtifacts.map((a) => ({
    type: normalizeArtifactType(String(a.type || 'text')),
    name: String(a.name || 'Result'),
    content: String(a.content || a.url || ''),
    mimeType: a.mime_type ? String(a.mime_type) : undefined,
  }));

  const result = data.result
    ? String(data.result)
    : data.output
    ? String(data.output)
    : undefined;

  return {
    id: taskId,
    prompt: String(data.input || data.prompt || ''),
    model: String(data.model || ''),
    status,
    createdAt: Number(data.created_at || data.createdAt || Date.now()),
    updatedAt: Number(data.updated_at || data.updatedAt || Date.now()),
    result,
    artifacts: artifacts.length > 0 ? artifacts : undefined,
    error: data.error ? String(data.error) : undefined,
    steps: steps.length > 0 ? steps : undefined,
  };
}

function normalizeStatus(s: string): ManusTaskStatus {
  const map: Record<string, ManusTaskStatus> = {
    pending: 'pending',
    queued: 'pending',
    running: 'running',
    processing: 'running',
    in_progress: 'running',
    completed: 'completed',
    done: 'completed',
    success: 'completed',
    failed: 'failed',
    error: 'failed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
  };
  return map[s.toLowerCase()] || 'pending';
}

function normalizeStepStatus(s: string): ManusStep['status'] {
  const map: Record<string, ManusStep['status']> = {
    pending: 'pending',
    running: 'running',
    processing: 'running',
    done: 'done',
    completed: 'done',
    success: 'done',
  };
  return map[s.toLowerCase()] || 'pending';
}

function normalizeArtifactType(t: string): ManusArtifact['type'] {
  const valid: ManusArtifact['type'][] = ['text', 'file', 'code', 'image', 'link'];
  return valid.includes(t as ManusArtifact['type']) ? (t as ManusArtifact['type']) : 'text';
}
