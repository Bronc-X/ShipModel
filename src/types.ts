export type ModelCategory = "vehicle" | "aircraft" | "ship";

export type ModelSubtype =
  | "race-car"
  | "off-road"
  | "future-sports"
  | "jet"
  | "airliner"
  | "biplane"
  | "space-fighter"
  | "warship"
  | "sailboat"
  | "vintage-ship";

export type RunStatus = "Ready" | "Failed";

export interface ModelRequest {
  category: ModelCategory;
  subtype: ModelSubtype;
  style: string;
  primaryColor: string;
  accentColor: string;
  label: string;
  markingText?: string;
  description: string;
  targetLengthMm: number;
}

export interface Concept {
  id: string;
  title: string;
  imageUrl: string;
  prompt: string;
  feedback?: string;
}

export interface ModelRun {
  runId: string;
  input: ModelRequest;
  concepts: Concept[];
  selectedConceptId?: string;
  status?: RunStatus;
  reasons: string[];
  files: {
    stl?: string;
    stlSourceUrl?: string;
    threeMf?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GenerateModelResponse {
  run: ModelRun;
}

export type ModelJobEvent =
  | { type: "job.started"; jobId: string; title: string; at: string }
  | { type: "step.started"; jobId: string; stepId: string; title: string; at: string }
  | { type: "tool.started"; jobId: string; callId: string; name: string; inputSummary?: string; at: string }
  | { type: "tool.completed"; jobId: string; callId: string; name: string; outputSummary?: string; at: string }
  | { type: "artifact.created"; jobId: string; artifactId: string; kind: string; title?: string; data: unknown; at: string }
  | { type: "artifact.patch"; jobId: string; artifactId: string; patch: unknown; at: string }
  | { type: "step.failed"; jobId: string; stepId: string; error: string; recoverable: boolean; at: string }
  | { type: "job.completed"; jobId: string; at: string; response?: GenerateModelResponse };

export type ConceptProgressPhase = "queued" | "validating" | "image" | "saving" | "complete";

export interface ConceptProgressEvent {
  phase: ConceptProgressPhase;
  progress: number;
  message: string;
  runId?: string;
  conceptIndex?: number;
  totalConcepts?: number;
  response?: {
    runId: string;
    concepts: Concept[];
  };
}

export interface HandshakeResponse {
  ok: true;
  app: "printable-model-demo";
  apiVersion: "0.1.0";
  mode: {
    imageProvider: "openai";
    modelProvider: "tripo";
  };
  configured: {
    openai: boolean;
    tripo: boolean;
  };
  capabilities: {
    conceptImages: true;
    modelGeneration: true;
    stlDownload: true;
    threeMfDownload: false;
    statuses: ["Ready", "Failed"];
  };
}
