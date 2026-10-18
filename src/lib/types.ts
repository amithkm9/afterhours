export type Platform = 'linkedin' | 'instagram';
export type EngineMode = 'llm' | 'rules';
export type ClaimCategory = 'interest' | 'hobby' | 'need' | 'quality' | 'work' | 'routine';

/** A stored excerpt from one of the two allowed account sources. */
export interface SourceDocument {
  id: string;
  platform: Platform;
  url: string;
  status: 'ready' | 'blocked' | 'failed';
  retrievedAt: string;
  content: string;
  metadata?: {
    name?: string;
    username?: string;
    isPublic?: boolean;
    imageUrl?: string;
    headline?: string;
    provenance?: 'apify' | 'public-page' | 'search-excerpt' | 'manual';
    identityVerified?: boolean;
    note?: string;
  };
}

export interface EvidenceReference { sourceId: string; quote: string }
export interface EvidenceClaim {
  id: string;
  category: ClaimCategory;
  text: string;
  kind: 'observed' | 'inferred';
  confidence: number;
  evidence: EvidenceReference[];
}

export interface PersonAnalysis {
  summary: string;
  claims: EvidenceClaim[];
  interests: string[];
  hobbies: string[];
  needs: string[];
  unknowns: string[];
  mode: EngineMode;
  model?: string;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string;
  linkedinUrl: string;
  instagramUrl: string;
  status: 'pending' | 'importing' | 'analyzing' | 'ready' | 'failed';
  sources: SourceDocument[];
  analysis?: PersonAnalysis;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string;
  headline?: string;
  error?: string;
  identityStatus?: 'verified' | 'unverified';
}

export interface DateTurn {
  id: string;
  personId: string;
  turn: number;
  message: string;
  evidenceIds: string[];
  /** Verbatim source phrase behind a live substantive turn; dialogue may paraphrase it. */
  groundingQuote?: string;
  action: 'propose' | 'respond' | 'adapt' | 'reflect' | 'explore' | 'connect';
  mode: EngineMode;
  createdAt: string;
}

export interface DateAssessment {
  personId: string;
  counterpartId: string;
  score: number;
  connection: string;
  tension: string;
  question: string;
  secondDate: 'yes' | 'maybe' | 'no';
  evidenceIds: string[];
  mode: EngineMode;
}

export interface DateSession {
  id: string;
  personAId: string;
  personBId: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  turns: DateTurn[];
  assessments: DateAssessment[];
  mode: EngineMode;
  model?: string;
  generation?: 'live' | 'offline';
  createdAt: string;
  updatedAt?: string;
  error?: string;
  /** Immutable public dossiers used for this date; preserve evidence after reanalysis. */
  profileSnapshots?: Record<string, Person>;
}

export interface RankingEntry {
  personId: string;
  candidateId: string;
  rank: number;
  score: number;
  profileScore: number;
  dateScore?: number;
  basis: 'profile' | 'date';
  confidence: 'low' | 'medium' | 'high';
  sharedInterests: string[];
  reasons: string[];
  unknowns: string[];
  dateId?: string;
}

export interface ProfileUrls { linkedinUrl: string; instagramUrl: string }
export interface ProviderConfig {
  apifyToken?: string;
  groqApiKey?: string;
  groqModel?: string;
  /** Opt in to the public anonymous model endpoint; no key or billing credential. */
  anonymousModel?: boolean;
  /** Sanitized validation feedback for a queued retry, not persona evidence. */
  retryContext?: string;
  fetchImpl?: typeof fetch;
  /** Per-actor dollar ceiling, charged only against the account's configured allowance. */
  maxCostUsd?: number;
  /** Local diagnostic hook; never persisted or sent to the model. */
  onUsage?: (usage: { model: string; inputTokens: number; outputTokens: number; totalTokens: number }) => void;
}

export interface ActorRun {
  platform: Platform;
  runId: string;
  datasetId: string;
  status: string;
}

export interface ImportJob {
  id: string;
  urls: ProfileUrls;
  runs: ActorRun[];
  status: 'running' | 'complete' | 'failed';
  sources: SourceDocument[];
  createdAt: string;
  error?: string;
}

export interface ScheduledPair { personAId: string; personBId: string; profileScore: number }
