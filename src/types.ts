/**
 * Shared types for the technical operations Q&A application.
 */

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
}

export interface PagePreview {
  number: number;
  source: string;
  preview: string;
}

export interface SearchResult {
  pageNumber: number;
  source: string;
  snippet: string;
}

export interface PageContent {
  number: number;
  content: string;
  sourceFile: string;
}

export interface SafetyLimit {
  id: string;
  parameter: string;
  limit: string;
  unit?: string;
  category: "cladding" | "fuel" | "boric" | "pressure";
  alertText: string;
}
