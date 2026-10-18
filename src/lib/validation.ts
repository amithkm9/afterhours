import type { ProfileUrls, SourceDocument } from './types';

export class EngineError extends Error {
  constructor(public code: string, message: string, public retryable = false, public status = 400) {
    super(message);
    this.name = 'EngineError';
  }
}

function parseUrl(input: string): URL {
  if (typeof input !== 'string' || !input.trim() || input.length > 2048) {
    throw new EngineError('INVALID_URL', 'Paste a complete public profile URL.');
  }
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new EngineError('INVALID_URL', 'Profile links must start with https://.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new EngineError('INVALID_URL', 'Use an ordinary HTTPS profile link without credentials or ports.');
  }
  return url;
}

export function normalizeProfileUrls(input: ProfileUrls): ProfileUrls {
  if (!input || typeof input !== 'object') throw new EngineError('INVALID_URL', 'Both profile links are required.');
  const linkedin = parseUrl(input.linkedinUrl);
  const instagram = parseUrl(input.instagramUrl);
  if (!/^(?:www\.|[a-z]{2}\.)?linkedin\.com$/i.test(linkedin.hostname)) {
    throw new EngineError('INVALID_LINKEDIN', 'The LinkedIn link must point to linkedin.com/in/person.');
  }
  const linkedinPath = linkedin.pathname.match(/^\/in\/([a-zA-Z0-9_\-\p{L}\p{N}%]+)\/?$/u);
  if (!linkedinPath || /%2f|%5c|%00/i.test(linkedinPath[1])) {
    throw new EngineError('INVALID_LINKEDIN', 'Use a personal LinkedIn profile, not a company, feed, or post.');
  }
  if (!/^(?:www\.)?instagram\.com$/i.test(instagram.hostname)) {
    throw new EngineError('INVALID_INSTAGRAM', 'The Instagram link must point to instagram.com/username.');
  }
  const instagramPath = instagram.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
  const reserved = new Set(['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct', 'about', 'legal', 'developer', 'privacy', 'terms']);
  if (!instagramPath || reserved.has(instagramPath[1].toLowerCase())) {
    throw new EngineError('INVALID_INSTAGRAM', 'Use an Instagram profile link, not a post, reel, or login page.');
  }
  return {
    linkedinUrl: `https://www.linkedin.com/in/${linkedinPath[1].toLowerCase()}/`,
    instagramUrl: `https://www.instagram.com/${instagramPath[1].toLowerCase()}/`,
  };
}

export function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function verifySources(sources: SourceDocument[], urls?: ProfileUrls): void {
  if (!Array.isArray(sources) || sources.length !== 2 || new Set(sources.map(s => s.platform)).size !== 2) {
    throw new EngineError('MISSING_SOURCES', 'Analysis needs exactly one LinkedIn source and one Instagram source.');
  }
  for (const source of sources) {
    if (!['linkedin', 'instagram'].includes(source.platform) || source.status !== 'ready' || !source.content?.trim()) {
      throw new EngineError('SOURCE_UNAVAILABLE', 'Both public profiles must return readable content before analysis.');
    }
    if (source.platform === 'instagram' && source.metadata?.isPublic !== true) {
      throw new EngineError('PRIVATE_INSTAGRAM', 'Instagram must be confirmed public before it can be analyzed.');
    }
  }
  if (urls) {
    const canonical = normalizeProfileUrls(urls);
    const actual = normalizeProfileUrls({
      linkedinUrl: sources.find(s => s.platform === 'linkedin')!.url,
      instagramUrl: sources.find(s => s.platform === 'instagram')!.url,
    });
    if (canonical.linkedinUrl !== actual.linkedinUrl || canonical.instagramUrl !== actual.instagramUrl) {
      throw new EngineError('SOURCE_MISMATCH', 'The returned source does not match the requested account.');
    }
  }
  verifyProfileIdentity(sources);
}

/** Reject clear mismatches; matching names alone never become verified identity. */
export function verifyProfileIdentity(sources: SourceDocument[]): 'verified' | 'unverified' {
  const linkedin = sources.find(source => source.platform === 'linkedin');
  const instagram = sources.find(source => source.platform === 'instagram');
  if (!linkedin || !instagram) return 'unverified';
  const crosslink = (document: SourceDocument, target: SourceDocument) => {
    const explicit = [...document.content.matchAll(/\bhttps?:\/\/[^\s<>"']+/gi)].map(match => match[0]);
    const bare = [...document.content.matchAll(/(?:^|[\s(])((?:www\.|[a-z]{2}\.)?(?:linkedin\.com|instagram\.com)\/[^\s<>"']+)/gi)].map(match => `https://${match[1]}`);
    const expected = normalizeProfileUrls({ linkedinUrl: linkedin.url, instagramUrl: instagram.url });
    return [...explicit, ...bare].some(candidate => {
      try {
        const link = candidate.replace(/[),.;!?]+$/, '');
        const actual = normalizeProfileUrls(target.platform === 'linkedin'
          ? { linkedinUrl: link, instagramUrl: instagram.url }
          : { linkedinUrl: linkedin.url, instagramUrl: link });
        return actual.linkedinUrl === expected.linkedinUrl && actual.instagramUrl === expected.instagramUrl;
      } catch { return false; }
    });
  };
  if (crosslink(linkedin, instagram) || crosslink(instagram, linkedin)) return 'verified';
  const name = (source: SourceDocument) => (source.metadata?.name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(token => token.length > 1);
  const left = name(linkedin); const right = name(instagram);
  if (left.length >= 2 && right.length >= 2 && !left.some(token => right.includes(token))) {
    const ownNameInBio = left.every(token => instagram.content.toLowerCase().includes(token));
    if (!ownNameInBio) throw new EngineError('IDENTITY_MISMATCH', 'These profiles identify different people. Use the same person’s official LinkedIn and Instagram accounts.');
  }
  return 'unverified';
}

export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
};

/** Local validation remains mandatory even when the provider promises JSON mode. */
export function validateJson<T>(value: unknown, schema: JsonSchema, path = 'response'): T {
  const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const allowed = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
  if (allowed.length && !allowed.includes(actualType) && !(allowed.includes('integer') && typeof value === 'number' && Number.isInteger(value))) {
    throw new EngineError('INVALID_MODEL_OUTPUT', `${path} has an invalid type.`, true, 502);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new EngineError('INVALID_MODEL_OUTPUT', `${path} has an unsupported value.`, true, 502);
  if (typeof value === 'string' && ((schema.minLength !== undefined && value.trim().length < schema.minLength) || (schema.maxLength !== undefined && value.length > schema.maxLength))) {
    throw new EngineError('INVALID_MODEL_OUTPUT', `${path} has an invalid length.`, true, 502);
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || (schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) {
    throw new EngineError('INVALID_MODEL_OUTPUT', `${path} is outside its supported range.`, true, 502);
  }
  if (Array.isArray(value)) {
    if ((schema.minItems !== undefined && value.length < schema.minItems) || (schema.maxItems !== undefined && value.length > schema.maxItems)) {
      throw new EngineError('INVALID_MODEL_OUTPUT', `${path} has an invalid number of items.`, true, 502);
    }
    if (schema.items) value.forEach((item, index) => validateJson(item, schema.items!, `${path}[${index}]`));
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) throw new EngineError('INVALID_MODEL_OUTPUT', `${path}.${key} is missing.`, true, 502);
    }
    for (const [key, item] of Object.entries(record)) {
      if (schema.properties?.[key]) validateJson(item, schema.properties[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) throw new EngineError('INVALID_MODEL_OUTPUT', `${path}.${key} is not allowed.`, true, 502);
    }
  }
  return value as T;
}

/** Provider errors are deliberately not echoed, because upstream payloads may contain credentials. */
export function safeError(error: unknown): { code: string; message: string; retryable: boolean } {
  if (error instanceof EngineError) return { code: error.code, message: error.message, retryable: error.retryable };
  return { code: 'UNEXPECTED_ERROR', message: 'The operation could not finish. Retry once the service is available.', retryable: true };
}
