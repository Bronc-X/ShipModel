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

export interface ConceptResponse {
  runId: string;
  concepts: Concept[];
}

export type ConceptProgressPhase = "queued" | "validating" | "image" | "saving" | "complete";

export interface ConceptProgressEvent {
  phase: ConceptProgressPhase;
  progress: number;
  message: string;
  runId?: string;
  conceptIndex?: number;
  totalConcepts?: number;
  response?: ConceptResponse;
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
    threeMf?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface GenerateModelRequest {
  runId: string;
  conceptId: string;
}

export interface GenerateModelResponse {
  run: ModelRun;
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
