import type { Concept, ModelRequest, RunStatus } from "../types";

export const historyStorageKey = "toybox:history";
export const lastProjectStorageKey = "toybox:last-project";
export const membershipStorageKey = "toybox:membership";

export type LocalHistoryStatus = "saved" | "concept" | "ready" | "failed";
export type MembershipPlan = "free" | "pro";

export interface LocalHistoryStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LocalHistoryEntry {
  id: string;
  input: ModelRequest;
  runId: string | null;
  concepts: Concept[];
  selectedConceptId: string | null;
  status: LocalHistoryStatus;
  createdAt: string;
  updatedAt: string;
  title: string;
  label: string;
  previewImageUrl: string | null;
}

export interface HistoryEntryInput {
  input: ModelRequest;
  runId?: string | null;
  concepts?: Concept[];
  selectedConceptId?: string | null;
  status: LocalHistoryStatus;
}

export interface MembershipSnapshot {
  plan: MembershipPlan;
  upgradedAt: string | null;
}

const maxHistoryEntries = 30;
const maxStoredConcepts = 2;
const maxPreviewImageLength = 1200;

export function getHistoryEntries(store: LocalHistoryStore = window.localStorage): LocalHistoryEntry[] {
  const raw = store.getItem(historyStorageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as LocalHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryEntry).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function appendHistoryEntry(
  store: LocalHistoryStore = window.localStorage,
  entryInput: HistoryEntryInput,
  now = new Date().toISOString()
) {
  const entries = getHistoryEntries(store);
  const runKey = entryInput.runId ?? null;
  const existingIndex = runKey ? entries.findIndex((entry) => entry.runId === runKey) : -1;
  const previous = existingIndex >= 0 ? entries[existingIndex] : null;
  const nextEntry: LocalHistoryEntry = {
    id: previous?.id ?? runKey ?? `local-${now}`,
    input: entryInput.input,
    runId: runKey,
    concepts: sanitizeConcepts(entryInput.concepts ?? previous?.concepts ?? []),
    selectedConceptId: entryInput.selectedConceptId ?? previous?.selectedConceptId ?? null,
    status: entryInput.status,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    title: buildHistoryTitle(entryInput.input),
    label: buildHistoryLabel(entryInput.input),
    previewImageUrl: toStoredPreview(entryInput.concepts?.[0]?.imageUrl ?? previous?.previewImageUrl ?? null)
  };

  const nextEntries = existingIndex >= 0
    ? entries.map((entry, index) => (index === existingIndex ? nextEntry : entry))
    : [nextEntry, ...entries];

  const sortedEntries = nextEntries
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, maxHistoryEntries)
    .map(toStoredHistoryEntry);

  safeSetHistory(store, sortedEntries);
  safeSetItem(store, lastProjectStorageKey, JSON.stringify(toLastProjectSnapshot(nextEntry)));

  return nextEntry;
}

export function entryFromRunStatus(status?: RunStatus): LocalHistoryStatus {
  if (status === "Ready") return "ready";
  if (status === "Failed") return "failed";
  return "concept";
}

export function getMembership(store: LocalHistoryStore = window.localStorage): MembershipSnapshot {
  const raw = store.getItem(membershipStorageKey);
  if (!raw) return { plan: "free", upgradedAt: null };

  try {
    const parsed = JSON.parse(raw) as MembershipSnapshot;
    if (parsed.plan !== "free" && parsed.plan !== "pro") {
      return { plan: "free", upgradedAt: null };
    }
    return {
      plan: parsed.plan,
      upgradedAt: parsed.upgradedAt ?? null
    };
  } catch {
    return { plan: "free", upgradedAt: null };
  }
}

export function setMembership(store: LocalHistoryStore = window.localStorage, plan: MembershipPlan, now = new Date().toISOString()) {
  const snapshot: MembershipSnapshot = {
    plan,
    upgradedAt: plan === "pro" ? now : null
  };
  store.setItem(membershipStorageKey, JSON.stringify(snapshot));
  return snapshot;
}

function buildHistoryTitle(input: ModelRequest) {
  return `${input.style} ${input.subtype}`;
}

function buildHistoryLabel(input: ModelRequest) {
  return input.markingText?.trim() || "未加标志";
}

function sanitizeConcepts(concepts: Concept[]) {
  return concepts.slice(0, maxStoredConcepts).map((concept) => ({
    ...concept,
    imageUrl: toStoredPreview(concept.imageUrl) ?? "",
    prompt: "",
    feedback: concept.feedback ? concept.feedback.slice(0, 220) : undefined
  }));
}

function toStoredPreview(imageUrl: string | null) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("data:") || imageUrl.length > maxPreviewImageLength) return null;
  return imageUrl;
}

function toLastProjectSnapshot(entry: LocalHistoryEntry): LocalHistoryEntry {
  return {
    ...toStoredHistoryEntry(entry),
    concepts: []
  };
}

function toStoredHistoryEntry(entry: LocalHistoryEntry): LocalHistoryEntry {
  return {
    ...entry,
    concepts: sanitizeConcepts(entry.concepts),
    previewImageUrl: toStoredPreview(entry.previewImageUrl)
  };
}

function safeSetHistory(store: LocalHistoryStore, entries: LocalHistoryEntry[]) {
  for (let keep = entries.length; keep >= 1; keep -= 1) {
    if (safeSetItem(store, historyStorageKey, JSON.stringify(entries.slice(0, keep)))) return;
  }
  safeSetItem(store, historyStorageKey, JSON.stringify([]));
}

function safeSetItem(store: LocalHistoryStore, key: string, value: string) {
  try {
    store.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;
    return false;
  }
}

function isQuotaExceededError(error: unknown) {
  return error instanceof DOMException && (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function isHistoryEntry(value: unknown): value is LocalHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as LocalHistoryEntry;
  return Boolean(entry.input && typeof entry.title === "string" && typeof entry.updatedAt === "string");
}
