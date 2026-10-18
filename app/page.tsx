'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import type { DateSession, EvidenceClaim, Person, RankingEntry } from '../src/lib/types';

type View = 'people' | 'dates' | 'matches' | 'about';
type IconName = 'heart' | 'compass' | 'chat' | 'sparkles' | 'arrow' | 'plus' | 'search' | 'close' | 'check' | 'link' | 'play' | 'info' | 'chevron' | 'refresh' | 'external' | 'book' | 'clock';
type ProviderStatus = { apify?: boolean | { configured?: boolean }; groq?: boolean | { configured?: boolean }; model?: boolean | { configured?: boolean }; [key: string]: unknown };
type AppData = { people: Person[]; dates: DateSession[]; providerStatus?: ProviderStatus; stats?: Record<string, number>; jobs?: { id: string; kind: string; status: string; nextAttemptAt?: string | number; error?: string }[] };
const EMPTY: AppData = { people: [], dates: [] };
function demoSnapshot() { return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'; }
function subscribeLocation(callback: () => void) { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); }
function serverDemoSnapshot() { return false; }
const NAV: { id: View; name: string; icon: IconName }[] = [
  { id: 'people', name: 'Discover people', icon: 'compass' },
  { id: 'dates', name: 'Agent dates', icon: 'chat' },
  { id: 'matches', name: 'The shortlist', icon: 'heart' },
  { id: 'about', name: 'How it works', icon: 'book' },
];

function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" /></>,
    chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l1.7-5A8.5 8.5 0 1 1 21 11.5Z" />,
    sparkles: <><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z" /><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    link: <><path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></>,
    play: <path d="m9 5 11 7-11 7V5Z" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10h.01" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" /></>,
    external: <><path d="M14 3h7v7m0-7L10 14" /><path d="M10 3H3v18h18v-7" /></>,
    book: <><path d="M12 5v16M3 3c4 0 6 0 9 2 3-2 5-2 9-2v16c-4 0-6 0-9 2-3-2-5-2-9-2V3Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?'; }
function colorIndex(id: string) { return [...id].reduce((total, char) => total + char.charCodeAt(0), 0) % 5; }
function firstName(person?: Person) { return person?.name?.split(' ')[0] || 'Agent'; }
function configured(value: ProviderStatus[string]) { return typeof value === 'boolean' ? value : !!(value && typeof value === 'object' && 'configured' in value && value.configured); }
function ready(person: Person) { return person.status === 'ready' && !!person.analysis; }
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(result.error || result.message || `Something went wrong (${response.status}). Please try again.`);
  return result;
}

function Avatar({ person, size = 'normal' }: { person?: Person; size?: 'small' | 'normal' | 'large' }) {
  // Source-supplied image hosts can expire; native image errors reveal the initials underneath.
  // eslint-disable-next-line @next/next/no-img-element
  return <span className={`avatar avatar-${size} tone-${colorIndex(person?.id || '')}`}>{person?.imageUrl ? <img src={person.imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /> : null}<span>{initials(person?.name || '?')}</span></span>;
}

function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = container.current?.querySelector<HTMLElement>('input,button,select,textarea,[tabindex="0"]');
    first?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const elements = [...(container.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input,select,textarea,summary,[tabindex="0"]') || [])];
      const start = elements[0]; const end = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end?.focus(); }
      else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start?.focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = originalOverflow; window.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div ref={container} role="dialog" aria-modal="true" aria-labelledby="dialog-title" className={`modal ${wide ? 'modal-wide' : ''}`}>
    <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
    <h2 id="dialog-title">{title}</h2>{description && <p className="modal-description">{description}</p>}{children}
  </div></div>;
}

function ProfileCard({ person, onOpen }: { person: Person; onOpen: () => void }) {
  const interestTags = [...(person.analysis?.interests || []), ...(person.analysis?.hobbies || [])].slice(0, 3);
  return <button className="person-card" onClick={onOpen}>
    <div className={`person-cover tone-${colorIndex(person.id)}`}>
      <span className="cover-orbit orbit-one" /><span className="cover-orbit orbit-two" /><span className="cover-star">✳</span>
      <Avatar person={person} size="large" />
      <span className={`status-pill ${ready(person) ? 'status-ready' : person.status === 'failed' ? 'status-failed' : ''}`}><span />{ready(person) ? 'Agent ready' : person.status === 'failed' ? 'Needs attention' : person.status === 'pending' ? 'Awaiting analysis' : `${person.status[0].toUpperCase()}${person.status.slice(1)}`}</span>
    </div>
    <div className="person-content"><div className="person-name-line"><h3>{person.name}</h3><span className="card-arrow"><Icon name="arrow" size={18} /></span></div>
      <p className="person-headline">{person.headline || (person.analysis ? 'A personality, backed by evidence.' : 'Getting to know this person')}</p>
      <p className="person-summary">{person.analysis?.summary || person.error || 'Their agent is reading the two profiles and finding the details that matter.'}</p>
      <div className="tag-row">{interestTags.length ? interestTags.map(tag => <span className="tag" key={tag}>{tag}</span>) : <span className="tag tag-muted">Two sources, one perspective</span>}</div>
      <div className="card-bottom"><span className="source-mini"><b>in</b><span className="instagram-mini">◎</span><span>{person.sources.filter(source => source.status === 'ready').length}/2 sources</span></span><span>{person.analysis?.claims.length || 0} insights</span></div>
    </div>
  </button>;
}

function Claim({ claim, person }: { claim: EvidenceClaim; person: Person }) {
  return <details className="claim"><summary><span className={`claim-dot ${claim.kind}`} /><span>{claim.text}</span><span className="claim-kind">{claim.kind === 'observed' ? 'Observed' : 'Inferred'}</span><Icon name="chevron" size={15} /></summary><div className="claim-evidence"><p className="eyebrow">{Math.round(claim.confidence * (claim.confidence <= 1 ? 100 : 1))}% confidence · {claim.category}</p>{claim.evidence.map((evidence, index) => {
    const source = person.sources.find(item => item.id === evidence.sourceId);
    return <div key={`${evidence.sourceId}-${index}`}><blockquote>“{evidence.quote}”</blockquote>{source && <a href={source.url} target="_blank" rel="noreferrer">View on {source.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} <Icon name="external" size={12} /></a>}</div>;
  })}</div></details>;
}

function ProfileModal({ person, onClose, onAnalyze, onMatches, busy, readOnly = false, contextLabel }: { person: Person; onClose: () => void; onAnalyze: () => void; onMatches: () => void; busy: boolean; readOnly?: boolean; contextLabel?: string }) {
  return <Modal title={person.name} onClose={onClose} wide>
    <div className="profile-intro"><Avatar person={person} size="large" /><div><span className="eyebrow">MEET THE PERSON BEHIND THE AGENT</span><p>{person.headline || 'Two profiles. A more complete picture.'}</p><div className="source-links"><a href={person.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn <Icon name="external" size={13} /></a><a href={person.instagramUrl} target="_blank" rel="noreferrer">Instagram <Icon name="external" size={13} /></a></div></div></div>
    {person.error && <div className="notice error-notice">{person.error}</div>}
    {person.analysis ? <>
      <div className="profile-summary"><Icon name="sparkles" size={22} /><div><span className="eyebrow">THE AGENT&apos;S READ</span><p>{person.analysis.summary}</p><span className="muted small">{person.analysis.mode === 'llm' ? (person.analysis.model === 'Codex offline analysis' ? 'Codex analysis · saved offline' : 'Model-assisted analysis') : 'Evidence-based rules analysis'} · {person.identityStatus === 'verified' ? 'Identity cross-checked' : 'Identity match not verified'}</span></div></div>
      <div className="profile-traits">{[{ label: 'Interests', values: person.analysis.interests }, { label: 'Hobbies', values: person.analysis.hobbies }, { label: 'Stated needs', values: person.analysis.needs }].map(group => <div key={group.label}><h4>{group.label}</h4><div className="tag-row">{group.values.length ? group.values.map(value => <span className="tag" key={value}>{value}</span>) : <span className="muted small">Not established in the sources</span>}</div></div>)}</div>
      <div className="section-heading compact"><h3>A little more substance</h3><span className="muted small">Click an insight to see its evidence</span></div><div className="claim-list">{person.analysis.claims.length ? person.analysis.claims.map(claim => <Claim key={claim.id} claim={claim} person={person} />) : <p className="muted">There isn&apos;t enough evidence for specific claims yet.</p>}</div>
      {!!person.analysis.unknowns.length && <div className="unknown-box"><Icon name="info" size={18} /><div><h4>Still a conversation to be had</h4><p>{person.analysis.unknowns.join(' · ')}</p></div></div>}
    </> : <div className="profile-summary"><Icon name="clock" /><div><h3>{person.status === 'importing' ? 'Reading the profiles…' : 'Ready to get acquainted'}</h3><p>Analysis appears here after both sources have been collected. Every insight will link back to its evidence.</p></div></div>}
    <h3 className="source-section-title">The two sources</h3><div className="source-documents">{person.sources.length ? person.sources.map(source => <details className="source-document" key={source.id}><summary><span className="source-letter">{source.platform === 'linkedin' ? 'in' : '◎'}</span><span><b>{source.platform === 'linkedin' ? 'LinkedIn' : 'Instagram'}</b><span className="small muted">{source.metadata?.provenance?.replace('-', ' ') || 'Profile retrieval'} · {source.status}</span></span><Icon name="chevron" size={16} /></summary><div className="source-document-body">{source.metadata?.note && <p className="notice">{source.metadata.note}</p>}<p>{source.content || 'No readable content was returned.'}</p><a href={source.url} target="_blank" rel="noreferrer">Open original source <Icon name="external" size={12} /></a></div></details>) : <p className="muted">The source records will appear when the import completes.</p>}</div>
    <div className="modal-actions">{!readOnly && <button className="button button-secondary" onClick={onAnalyze} disabled={busy || person.status === 'importing'}><Icon name="refresh" size={16} />{busy ? 'Analyzing…' : person.status === 'failed' && person.sources.filter(source => source.status === 'ready').length < 2 ? 'Retry import' : person.analysis ? 'Refresh analysis' : 'Analyze profile'}</button>}{readOnly && <span className="saved-profile-note"><Icon name="book" size={14} /> {contextLabel || 'From the saved example'}</span>}<button className="button button-primary" onClick={onMatches} disabled={!person.analysis}>See their shortlist <Icon name="arrow" size={17} /></button></div>
  </Modal>;
}

function ImportModal({ onClose, onImport, busy }: { onClose: () => void; onImport: (linkedinUrl: string, instagramUrl: string) => Promise<void>; busy: boolean }) {
  const [linkedin, setLinkedin] = useState(''); const [instagram, setInstagram] = useState(''); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await onImport(linkedin.trim(), instagram.trim()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Import failed. Please try again.'); } }
  return <Modal title="Make an introduction." description="Two public profiles. One agent that gets to know the person behind them." onClose={onClose}>
    <form onSubmit={submit}><label className="field-label" htmlFor="linkedin">LinkedIn profile</label><div className="input-wrap"><span className="input-brand">in</span><input id="linkedin" type="url" required placeholder="https://www.linkedin.com/in/…" value={linkedin} onChange={event => setLinkedin(event.target.value)} autoComplete="off" /></div>
      <label className="field-label" htmlFor="instagram">Public Instagram profile</label><div className="input-wrap"><span className="input-brand instagram-brand">◎</span><input id="instagram" type="url" required placeholder="https://www.instagram.com/…" value={instagram} onChange={event => setInstagram(event.target.value)} autoComplete="off" /></div>
      <div className="import-explainer"><span>01</span><p>Read both profiles</p><Icon name="arrow" size={14} /><span>02</span><p>Find the evidence</p><Icon name="arrow" size={14} /><span>03</span><p>Meet their agent</p></div>
      <p className="small muted">Use the same adult person&apos;s official accounts. Private or unavailable profiles won&apos;t be filled in with guesses.</p>
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? <><span className="spinner" /> Reading their profiles…</> : <>Create their agent <Icon name="arrow" size={18} /></>}</button>
    </form>
  </Modal>;
}

function DateModal({ people, onClose, onStart, busy }: { people: Person[]; onClose: () => void; onStart: (a: string, b: string) => Promise<void>; busy: boolean }) {
  const [a, setA] = useState(people[0]?.id || ''); const [b, setB] = useState(people[1]?.id || ''); const [error, setError] = useState('');
  return <Modal title="A table for two." description="Their agents will meet, find common ground, and see where the conversation goes." onClose={onClose}>
    <form onSubmit={async event => { event.preventDefault(); setError(''); try { await onStart(a, b); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start the date.'); } }}>
      <div className="date-pair-preview"><Avatar person={people.find(person => person.id === a)} size="large" /><span className="date-heart"><Icon name="heart" size={27} /></span><Avatar person={people.find(person => person.id === b)} size="large" /></div>
      <label className="field-label" htmlFor="agent-a">First agent</label><select id="agent-a" value={a} onChange={event => { setA(event.target.value); if (event.target.value === b) setB(people.find(person => person.id !== event.target.value)?.id || ''); }} required>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
      <label className="field-label" htmlFor="agent-b">Second agent</label><select id="agent-b" value={b} onChange={event => setB(event.target.value)} required>{people.filter(person => person.id !== a).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select>
      <p className="small muted simulation-note"><Icon name="info" size={15} /> This is a simulation between agents. It does not imply that these people have met or participated.</p>
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <button type="submit" className="button button-primary button-full" disabled={busy || !a || !b || a === b}>{busy ? <><span className="spinner" /> Setting the table…</> : <>Let them break the ice <Icon name="sparkles" size={17} /></>}</button>
    </form>
  </Modal>;
}

function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={31} /></div><h3>{title}</h3><p>{children}</p>{action}</div>;
}

function SettingsModal({ status, onClose, onSave }: { status?: ProviderStatus; onClose: () => void; onSave: () => Promise<unknown> }) {
  const [apifyToken, setApifyToken] = useState(''); const [groqApiKey, setGroqApiKey] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(''); try { await request('/api/settings', { ...(apifyToken.trim() ? { apifyToken: apifyToken.trim() } : {}), ...(groqApiKey.trim() ? { groqApiKey: groqApiKey.trim() } : {}) }); await onSave(); onClose(); } catch (cause) { setError((cause as Error).message); } finally { setSaving(false); } }
  return <Modal title="A little extra connection." description="The anonymous free model needs no key. Add your own providers for optional retrieval and model alternatives." onClose={onClose}><form onSubmit={submit}>
    <label className="field-label" htmlFor="apify-token">Apify API token {configured(status?.apify) && <span className="connected-label">· Connected</span>}</label><div className="input-wrap"><Icon name="link" size={16} /><input type="password" id="apify-token" value={apifyToken} onChange={event => setApifyToken(event.target.value)} placeholder={configured(status?.apify) ? 'Leave blank to keep your existing token' : 'Your Apify API token'} autoComplete="off" /></div><p className="field-help">Retrieve public Instagram and LinkedIn profiles. <a href="https://console.apify.com/settings/integrations" target="_blank" rel="noreferrer">Find your token <Icon name="external" size={10} /></a></p>
    <label className="field-label" htmlFor="groq-key">Groq API key {configured(status?.groq) && <span className="connected-label">· Connected</span>}</label><div className="input-wrap"><Icon name="sparkles" size={16} /><input type="password" id="groq-key" value={groqApiKey} onChange={event => setGroqApiKey(event.target.value)} placeholder={configured(status?.groq) ? 'Leave blank to keep your existing key' : 'Your Groq API key (optional)'} autoComplete="off" /></div><p className="field-help">Optional alternative to the anonymous model for analysis and agent replies. <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Create a free key <Icon name="external" size={10} /></a></p>
    <div className="settings-note"><Icon name="info" size={16} /><p>Keys are encrypted on the server for this workspace. The default model uses a public anonymous endpoint without billing credentials. If unavailable, the operation reports an error; it does not invent AI output.</p></div>{error && <div className="notice error-notice" role="alert">{error}</div>}<button type="submit" className="button button-primary button-full" disabled={saving || (!apifyToken.trim() && !groqApiKey.trim())}>{saving ? <><span className="spinner" /> Saving connections…</> : <>Save connections <Icon name="check" size={17} /></>}</button>
  </form></Modal>;
}

export default function Home() {
  const demoMode = useSyncExternalStore(subscribeLocation, demoSnapshot, serverDemoSnapshot);
  const [shareLink, setShareLink] = useState('');
  const [data, setData] = useState<AppData>(EMPTY); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const [view, setView] = useState<View>('people'); const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [profileId, setProfileId] = useState<string | null>(null); const [profileDateId, setProfileDateId] = useState<string | null>(null); const [importOpen, setImportOpen] = useState(false); const [dateOpen, setDateOpen] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(''); const [dateId, setDateId] = useState(''); const [rankingPersonId, setRankingPerson] = useState(''); const [rankings, setRankings] = useState<RankingEntry[]>([]); const [rankingLoadedFor, setRankingLoadedFor] = useState('');
  const rankingPerson = rankingPersonId || data.people.find(ready)?.id || '';
  const rankingLoading = !!rankingPerson && rankingLoadedFor !== rankingPerson;
  const completedCount = data.dates.filter(date => date.status === 'complete').length;
  const readyCount = data.people.filter(ready).length;
  const transcriptEnd = useRef<HTMLDivElement>(null); const polling = useRef(false); const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  const load = useCallback(async () => { const result = await request<AppData>(`/api/state${demoSnapshot() ? '?demo=1' : ''}`); setData({ ...result, people: result.people || [], dates: result.dates || [] }); return result; }, []);
  useEffect(() => {
    let stopped = false;
    async function tick(initial = false) {
      if (polling.current) return; polling.current = true;
      try { const state = await load(); if (initial) setLoading(false); if (!demoSnapshot() && !stopped && !busyRef.current && state.jobs?.some(job => ['pending', 'running'].includes(job.status) && (!job.nextAttemptAt || new Date(job.nextAttemptAt).getTime() <= Date.now()))) { await request('/api/jobs/step', {}); await load(); } }
      catch (cause) { if (initial) setError((cause as Error).message); }
      finally { polling.current = false; if (initial) setLoading(false); }
    }
    void tick(true); const timer = setInterval(() => { if (!demoSnapshot()) void tick(); }, 1200);
    return () => { stopped = true; clearInterval(timer); };
  }, [load]);
  useEffect(() => { const sync = () => { const hash = window.location.hash.slice(1); if (NAV.some(item => item.id === hash)) setView(hash as View); }; sync(); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (view !== 'matches' || !rankingPerson) return;
    let ignore = false;
    request<RankingEntry[] | { rankings: RankingEntry[] }>(`/api/rankings?personId=${encodeURIComponent(rankingPerson)}${demoMode ? '&demo=1' : ''}`).then(result => { if (!ignore) { setRankings(Array.isArray(result) ? result : result.rankings || []); setRankingLoadedFor(rankingPerson); } }).catch(cause => { if (!ignore) { setError(cause.message); setRankings([]); setRankingLoadedFor(rankingPerson); } });
    return () => { ignore = true; };
  }, [view, rankingPerson, completedCount, readyCount, demoMode]);

  const currentDate = data.dates.find(date => date.id === dateId) || data.dates[0];
  useEffect(() => { if (currentDate?.status === 'running' && currentDate.turns.length) transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [currentDate?.id, currentDate?.status, currentDate?.turns.length]);
  const profileSnapshot = profileId ? data.dates.find(date => date.id === profileDateId)?.profileSnapshots?.[profileId] : undefined;
  const selectedProfile = profileId ? profileSnapshot || data.people.find(person => person.id === profileId) : undefined;
  const readyPeople = data.people.filter(ready); const completedDates = data.dates.filter(date => date.status === 'complete');
  const activeJobs = data.jobs?.filter(job => ['pending', 'running'].includes(job.status)).length || 0;
  const visiblePeople = data.people.filter(person => (filter === 'all' || (filter === 'ready' ? ready(person) : !ready(person))) && [person.name, person.headline, ...(person.analysis?.interests || []), ...(person.analysis?.hobbies || [])].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()));
  function navigate(next: View) { setView(next); window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${next}`); setError(''); requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' })); }
  // Reload to clear all saved-example UI state before entering the writable workspace.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  function tryOwnLinks() { window.location.assign('/?own=1'); }
  async function shareDemo() { const link = `${window.location.origin}/?demo=1`; try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(link); setToast('Saved example link copied. Ready to share.'); } catch { setShareLink(link); } }
  async function importPerson(linkedinUrl: string, instagramUrl: string) { if (demoSnapshot()) return; setBusy('import'); try { await request('/api/import', { linkedinUrl, instagramUrl }); await load(); setImportOpen(false); navigate('people'); setToast('Introduction made. Your new agent is getting acquainted.'); } finally { setBusy(''); } }
  async function analyze(personId: string) { if (demoSnapshot()) return; setBusy(`analyze-${personId}`); setError(''); try { await request('/api/analyze', { personId }); await load(); setToast('Analysis queued. The profile will update as soon as it is ready.'); } catch (cause) { setError((cause as Error).message); } finally { setBusy(''); } }
  async function startDate(personAId: string, personBId: string) { if (demoSnapshot()) return; setBusy('date'); try { const result = await request<DateSession | { date: DateSession }>('/api/dates', { personAId, personBId }); const date = 'date' in result ? result.date : result; await load(); if (date?.id) setDateId(date.id); setDateOpen(false); navigate('dates'); setToast(date?.status === 'complete' ? 'Opened this pair’s saved conversation and assessments.' : 'The table is ready. Their agents are getting the conversation started.'); } finally { setBusy(''); } }
  async function advanceDate(date: DateSession, full = false) { if (demoSnapshot()) return; setBusy(`run-${date.id}`); setError(''); try { for (let index = 0; index < (full ? 8 : 1); index++) { await request(`/api/dates/${encodeURIComponent(date.id)}/step`, {}); const latest = await load(); const updated = latest.dates.find(item => item.id === date.id); if (!updated || updated.status === 'complete' || updated.status === 'failed') break; } } catch (cause) { setError((cause as Error).message); } finally { setBusy(''); } }
  async function scheduleDates() { if (demoSnapshot()) return; setBusy('schedule'); setError(''); try { const result = await request<{ scheduled: number }>('/api/dates/schedule', {}); await load(); setToast(`${result.scheduled} agent dates arranged. Conversations will start automatically.`); } catch (cause) { setError((cause as Error).message); } finally { setBusy(''); } }
  function openProfile(id: string, date?: DateSession) { setProfileDateId(date?.id || null); setProfileId(id); }
  function closeProfile() { setProfileId(null); setProfileDateId(null); }
  function openDate(id: string) { setDateId(id); navigate('dates'); }
  function openMatches(id: string) { setRankingPerson(id); closeProfile(); navigate('matches'); }

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#people" onClick={() => navigate('people')} aria-label="After Hours home"><span className="brand-mark"><Icon name="heart" size={23} /></span><span>after<span className="brand-hours">hours</span></span></a>
      <div className="sidebar-caption">GOOD CONNECTIONS TAKE CURIOSITY.</div>
      <nav aria-label="Main navigation">{NAV.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`nav-item ${view === item.id ? 'active' : ''}`} aria-current={view === item.id ? 'page' : undefined}><Icon name={item.icon} size={20} /><span>{item.name}</span>{item.id === 'dates' && data.dates.some(date => date.status === 'running') && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="club-card"><span className="club-symbol">✳</span><span className="eyebrow">LESS SWIPING.<br />MORE SUBSTANCE.</span><p>Let the conversation<br />come before the spark.</p></div><button className="sidebar-settings" onClick={shareDemo}><Icon name="external" size={14} /> Share saved example <Icon name="chevron" size={12} /></button>{!demoMode && <button className="sidebar-settings" onClick={() => setSettingsOpen(true)}><Icon name="link" size={14} /> Provider connections <Icon name="chevron" size={12} /></button>}<div className="sidebar-footer"><span className="tiny-heart">♡</span><span>A little human. A little agentic.</span></div></div>
    </aside>

    <main className="main-content"><header className="topbar"><div className="breadcrumb">THE AFTER HOURS CLUB <span>/</span> {NAV.find(item => item.id === view)?.name.toUpperCase()}</div><div className="topbar-right"><span className="live-label"><span /> {demoMode ? 'Saved example' : loading ? 'Connecting' : activeJobs ? `${activeJobs} task${activeJobs === 1 ? '' : 's'} in progress` : 'Live workspace'}</span>{demoMode ? <button className="button button-primary button-small" onClick={tryOwnLinks}><span>Try your own links</span><Icon name="arrow" size={16} /></button> : <button className="button button-primary button-small" onClick={() => setImportOpen(true)}><Icon name="plus" size={17} /><span>Add a person</span></button>}</div></header>
      {demoMode && <div className="demo-banner"><span className="demo-badge"><Icon name="book" size={14} />Saved {data.people.length ? `${data.people.length}-person ` : ''}example</span><p>Profiles, completed conversations, and explained shortlists.</p><button className="text-link" onClick={shareDemo}>Copy demo link <Icon name="link" size={14} /></button></div>}
      {error && <div className="notice error-notice global-notice" role="alert"><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><Icon name="close" size={15} /></button></div>}
      {view === 'people' && <>
        <section className="hero"><div className="hero-copy"><span className="eyebrow hero-eyebrow"><span /> HUMAN CONNECTION, AGENT CURIOSITY</span><h1>Let your agents<br /><em>break the ice.</em><span className="hero-spark">✳</span></h1><p>Real people. Thoughtful agents. Conversations that<br className="desktop-break" /> discover what a profile alone can&apos;t tell you.</p><button className="text-link hero-link" onClick={() => navigate('about')}>A different way to connect <Icon name="arrow" size={17} /></button></div><div className="hero-art" aria-hidden="true"><div className="art-label top-label">A GOOD CONVERSATION<br />CHANGES EVERYTHING.</div><div className="art-circle circle-left"><span>hello.</span></div><div className="art-circle circle-right"><span>hey you.</span></div><div className="art-overlap"><Icon name="heart" size={43} /></div><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span><div className="art-label bottom-label">A LITTLE CHEMISTRY,<br />A LOT OF POSSIBILITY.</div><span className="art-line" /></div></section>
        <section className="stats-strip" aria-label="Workspace activity"><div><span className="stat-number">{String(data.people.length).padStart(2, '0')}</span><span>people to discover</span></div><div><span className="stat-number">{String(readyPeople.length).padStart(2, '0')}</span><span>agents ready to mingle</span></div><div><span className="stat-number">{String(completedDates.length).padStart(2, '0')}</span><span>conversations completed</span></div><span className="stats-footnote"><Icon name="link" size={15} /> Always grounded in two sources.</span></section>
        <section className="people-section"><div className="section-heading"><div><span className="eyebrow section-eyebrow">EVERY PERSON HAS A STORY</span><h2>Meet the people<span className="heading-dot">.</span></h2></div><label className="search-wrap"><Icon name="search" size={18} /><input aria-label="Search people or interests" value={query} onChange={event => setQuery(event.target.value)} placeholder="A name, an interest, a spark…" /></label></div><div className="people-toolbar"><div className="tabs" aria-label="Filter people">{[{ id: 'all', label: 'Everyone', count: data.people.length }, { id: 'ready', label: 'Ready to mingle', count: readyPeople.length }, { id: 'processing', label: 'Getting acquainted', count: data.people.length - readyPeople.length }].map(tab => <button key={tab.id} className={filter === tab.id ? 'selected' : ''} onClick={() => setFilter(tab.id)}>{tab.label}<span>{tab.count}</span></button>)}</div><span className="small muted">Curiosity looks good on everyone.</span></div>
          {loading ? <div className="people-grid">{[1, 2, 3].map(item => <div className="skeleton-card" key={item}><div /><span /><span /><span /></div>)}</div> : visiblePeople.length ? <div className="people-grid">{visiblePeople.map(person => <ProfileCard key={person.id} person={person} onOpen={() => openProfile(person.id)} />)}{!demoMode && <button className="add-person-card" onClick={() => setImportOpen(true)}><span className="add-person-circle"><Icon name="plus" size={28} /></span><h3>A new face.<br />A new possibility.</h3><p>Introduce someone with their<br />LinkedIn and public Instagram.</p><span className="text-link">Make an introduction <Icon name="arrow" size={16} /></span></button>}</div> : query || filter !== 'all' ? <EmptyState icon="search" title="No one here just yet." action={<button className="button button-secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Show everyone</button>}>Try another name or interest, or explore all the people in your workspace.</EmptyState> : <div className="first-person"><div className="first-person-art" aria-hidden="true"><span>A</span><span>?</span><i>♡</i></div><div><span className="eyebrow">EVERY GOOD STORY STARTS SOMEWHERE</span><h3>Who should we meet first?</h3><p>Introduce a real person with their LinkedIn and public Instagram.<br />Their agent will take it from there, one insight at a time.</p><button className="button button-primary" onClick={demoMode ? tryOwnLinks : () => setImportOpen(true)}>{demoMode ? 'Try your own links' : 'Make the first introduction'} <Icon name="arrow" size={18} /></button></div></div>}
        </section>
        <div className="bottom-note"><Icon name="sparkles" size={18} /><p>A profile is a starting point. <span>A conversation is where it gets interesting.</span></p><button className="text-link" onClick={() => navigate('dates')}>Meet the agents <Icon name="arrow" size={16} /></button></div>
      </>}

      {view === 'dates' && <section className="workspace-section"><div className="page-heading"><span className="eyebrow">LET&apos;S SEE WHERE THIS GOES</span><div><h1>Good company.<br /><em>Better conversation.</em></h1>{!demoMode && <div className="page-actions"><button className="button button-secondary" onClick={scheduleDates} disabled={readyPeople.length < 2 || !!busy}><Icon name="sparkles" size={16} />{busy === 'schedule' ? 'Pairing…' : 'Pair the group'}</button><button className="button button-primary" onClick={() => setDateOpen(true)} disabled={readyPeople.length < 2}><Icon name="plus" size={18} />Arrange a date</button></div>}</div><p>Two perspectives at one table. Follow the conversation, then hear what each agent thinks.</p></div>
        {!data.dates.length ? <EmptyState icon="chat" title="The best part is yet to come." action={demoMode ? <button className="button button-secondary" onClick={tryOwnLinks}>Try your own links <Icon name="arrow" size={17} /></button> : readyPeople.length >= 2 ? <button className="button button-primary" onClick={() => setDateOpen(true)}>Arrange the first date <Icon name="arrow" size={17} /></button> : <button className="button button-primary" onClick={() => setImportOpen(true)}>Introduce two people <Icon name="plus" size={17} /></button>}>Once two profiles are analyzed, their agents can find common ground, ask questions, and decide if there&apos;s more to explore.</EmptyState> : <div className="date-workspace"><aside className="date-list"><div className="date-list-heading">THE GUEST LIST <span>{data.dates.length}</span></div>{data.dates.map(date => { const a = data.people.find(person => person.id === date.personAId); const b = data.people.find(person => person.id === date.personBId); return <button key={date.id} className={`date-list-item ${currentDate?.id === date.id ? 'selected' : ''}`} onClick={() => setDateId(date.id)}><div className="paired-avatars"><Avatar person={a} size="small" /><Avatar person={b} size="small" /></div><span><b>{firstName(a)} & {firstName(b)}</b><span>{date.status === 'complete' ? 'Conversation complete' : date.status === 'failed' ? 'Needs attention' : date.turns.length ? `${date.turns.length} messages · in progress` : 'Ready to meet'}</span></span><Icon name="chevron" size={14} /></button>; })}</aside>
          {currentDate && <div className="date-room"><div className="date-room-header"><div className="date-room-pair">{[currentDate.personAId, currentDate.personBId].map((id, index) => { const person = data.people.find(item => item.id === id); return <span key={id}>{index === 1 && <span className="pair-ampersand">&</span>}<Avatar person={person} size="small" /><button onClick={() => openProfile(id, currentDate)}>{firstName(person)}<span>&apos;s agent</span></button></span>; })}</div><span className="simulation-badge"><Icon name="sparkles" size={12} /> AGENT SIMULATION</span></div><div className="date-context"><Icon name="chat" size={16} /><span>{currentDate.status === 'complete' ? 'Saved conversation' : 'A first conversation'} · {currentDate.mode === 'llm' ? (currentDate.generation === 'offline' ? 'Codex agents · offline model run' : 'Model-powered agents') : 'Rules-based preview'}</span></div>
            <div className="transcript" aria-live="polite">{!currentDate.turns.length && <div className="table-ready"><span>✳</span><h3>The table is set.</h3><p>Give their agents a moment to make the first move.</p></div>}{currentDate.turns.map(turn => { const person = data.people.find(item => item.id === turn.personId); const isB = turn.personId === currentDate.personBId; return <div className={`turn ${isB ? 'turn-right' : ''}`} key={turn.id}><Avatar person={person} size="small" /><div className="turn-content"><div className="turn-label"><b>{firstName(person)}&apos;s agent</b><span>{turn.action === 'propose' ? 'BREAKING THE ICE' : turn.action === 'adapt' ? 'FINDING COMMON GROUND' : turn.action === 'reflect' ? 'SETTLING IN' : turn.action === 'explore' ? 'AT THE TABLE' : turn.action === 'connect' ? 'GOING A LITTLE DEEPER' : 'KEEPING IT GOING'}</span></div><div className="turn-bubble">{turn.message}</div>{turn.evidenceIds.length > 0 && <button className="turn-source" onClick={() => openProfile(turn.personId, currentDate)}><Icon name="link" size={12} />Grounded in {turn.evidenceIds.length} profile insight{turn.evidenceIds.length === 1 ? '' : 's'}</button>}{turn.groundingQuote && <details className="turn-grounding"><summary>Source phrase</summary><blockquote>{turn.groundingQuote}</blockquote></details>}</div></div>; })}{busy === `run-${currentDate.id}` && <div className="thinking"><span /><span /><span /><p>An agent is considering its next move…</p></div>}<div ref={transcriptEnd} /></div>
            {currentDate.error && <div className="notice error-notice">{currentDate.error}</div>}
            {!demoMode && currentDate.status !== 'complete' && <div className="date-controls"><p><Icon name="info" size={14} /> Each reply builds on the conversation. Free model replies are queued about 45 seconds apart.</p><div><button className="button button-secondary button-small" onClick={() => advanceDate(currentDate)} disabled={!!busy}>Next turn <Icon name="chevron" size={15} /></button><button className="button button-primary button-small" onClick={() => advanceDate(currentDate, true)} disabled={!!busy}>{busy === `run-${currentDate.id}` ? <><span className="spinner" /> In conversation…</> : <><Icon name="play" size={15} />{currentDate.turns.length ? 'Continue the date' : 'Start the conversation'}</>}</button></div></div>}
            {!!currentDate.assessments.length && <div className="date-assessments"><div className="section-heading compact"><h3>So, how did it go?</h3><span className="small muted">Two independent perspectives</span></div><div className="assessment-grid">{currentDate.assessments.map(assessment => { const person = data.people.find(item => item.id === assessment.personId); return <div className="assessment" key={assessment.personId}><div className="assessment-heading"><Avatar person={person} size="small" /><b>{firstName(person)}&apos;s take</b><span className={`second-date ${assessment.secondDate}`}>{assessment.secondDate === 'yes' ? 'Would meet again' : assessment.secondDate === 'maybe' ? 'Open to another chat' : 'A different direction'}</span></div><h4>The connection</h4><p>{assessment.connection}</p><h4>Worth exploring</h4><p>{assessment.tension}</p><h4>One more question</h4><p>{assessment.question}</p><button className="text-link" onClick={() => openMatches(assessment.personId)}>See their shortlist <Icon name="arrow" size={14} /></button></div>; })}</div></div>}
          </div>}
        </div>}
        <p className="simulation-footer">Agent conversations are simulations, not statements made by the people represented. Dating intent and availability are unknown unless explicitly stated in the sources.</p>
      </section>}

      {view === 'matches' && <section className="workspace-section"><div className="page-heading"><span className="eyebrow">PROMISING CONNECTIONS, EXPLAINED</span><div><h1>More than<br /><em>a lucky match.</em></h1><div className="ranking-select"><label htmlFor="ranking-person">A SHORTLIST FOR</label><select id="ranking-person" value={rankingPerson} onChange={event => setRankingPerson(event.target.value)} disabled={!readyPeople.length}>{!readyPeople.length && <option value="">Add someone to begin</option>}{readyPeople.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div></div><p>A little shared curiosity. A little conversation. Every suggestion has a reason behind it.</p></div>
        <div className="ranking-legend"><span><i className="legend-dot date-dot" />Date-informed</span><span><i className="legend-dot profile-dot" />Profile-based estimate</span><p>Scores are a comparison tool, not a probability of romance.</p></div>
        {rankingLoading ? <div className="loading-message"><span className="spinner" /> Finding the promising connections…</div> : rankings.length ? <div className="ranking-list">{rankings.map((ranking, index) => { const candidate = data.people.find(person => person.id === ranking.candidateId); if (!candidate) return null; return <article className={`ranking-card ${index === 0 ? 'top-ranked' : ''}`} key={ranking.candidateId}><div className="ranking-position">{String(index + 1).padStart(2, '0')}</div><Avatar person={candidate} size="large" /><div className="ranking-main"><div className="ranking-name"><button onClick={() => openProfile(candidate.id)}><h3>{candidate.name}</h3></button><span className={`ranking-basis ${ranking.basis}`}>{ranking.basis === 'date' ? 'Date-informed' : 'Profile estimate'}</span></div><p>{ranking.reasons[0] || 'Their profiles offer a starting point for a conversation.'}</p><div className="tag-row">{ranking.sharedInterests.slice(0, 4).map(interest => <span className="tag" key={interest}>{interest}</span>)}</div><details className="ranking-details"><summary>Why this connection <Icon name="chevron" size={13} /></summary><ul>{ranking.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>{ranking.unknowns.length > 0 && <p><b>Still unknown:</b> {ranking.unknowns.join(' · ')}</p>}<p>Evidence confidence: {ranking.confidence}. Profile score: {Math.round(ranking.profileScore)}{ranking.dateScore !== undefined ? ` · Date assessment: ${Math.round(ranking.dateScore)}` : ''}.</p></details></div><div className="ranking-score"><span>{Math.round(ranking.score)}<small>/100</small></span><p>connection score</p>{ranking.dateId ? <button className="button button-secondary button-small" onClick={() => openDate(ranking.dateId!)}>Read their date <Icon name="arrow" size={14} /></button> : demoMode ? <span className="saved-date-note">No saved date</span> : <button className="button button-secondary button-small" disabled={!!busy} onClick={() => startDate(rankingPerson, candidate.id).catch(cause => setError(cause.message))}>Let them meet <Icon name="arrow" size={14} /></button>}</div></article>; })}</div> : <EmptyState icon="heart" title="There's a connection waiting." action={<button className="button button-primary" onClick={() => navigate('people')}>Meet the people <Icon name="arrow" size={17} /></button>}>Analyze at least two profiles to discover their shared interests. A date adds the perspective only a conversation can bring.</EmptyState>}
      </section>}

      {view === 'about' && <section className="workspace-section about-section"><div className="page-heading"><span className="eyebrow">THOUGHTFUL BY DESIGN</span><h1>People are more<br /><em>than a profile.</em></h1><p>After Hours gives every person an agent with a little curiosity and a lot of context. Here&apos;s how an introduction becomes a conversation.</p></div><div className="how-grid">{[{ number: '01', icon: 'link' as IconName, title: 'Two sides of a story.', text: 'Introduce someone with their official LinkedIn and public Instagram. Their agent reads only those two sources, and saves what it finds.' }, { number: '02', icon: 'sparkles' as IconName, title: 'Get to know the person.', text: 'Interests, hobbies, work, and stated needs become an evidence-backed profile. Observations and interpretations stay separate. Unknowns stay unknown.' }, { number: '03', icon: 'chat' as IconName, title: 'Let the agents meet.', text: 'Each agent brings its own perspective to a shared conversation. They arrange a hypothetical outing, share ideas during the simulated date, and independently assess the conversation.' }, { number: '04', icon: 'heart' as IconName, title: 'Find the promising things.', text: 'Explore a ranked shortlist with clear reasons, shared interests, and unanswered questions. Completed dates add a new dimension to the picture.' }].map(step => <article className="how-card" key={step.number}><div><span>{step.number}</span><Icon name={step.icon} size={26} /></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div><div className="principles-panel"><div><span className="eyebrow">A FEW THINGS WE BELIEVE</span><h2>Good connections<br />start with honesty.</h2></div><div><h4>Evidence over assumptions.</h4><p>Every personal insight links to the source behind it. A public interest does not establish a romantic preference.</p><h4>Simulated dates. Real transparency.</h4><p>These agents do not speak for the real people. All conversations are labeled simulations, and rule-based or model-assisted processing is identified.</p><h4>A shortlist, not a verdict.</h4><p>Rankings are transparent heuristics. They&apos;re an invitation to explore, never a promise of compatibility.</p></div></div>{!demoMode && <><div className="provider-panel"><div><Icon name="info" size={20} /><div><h3>Your workspace connections</h3><p>Profile retrieval and optional model-assisted conversations.</p></div></div><div className="provider-status"><span><i className={configured(data.providerStatus?.apify) ? 'connected' : ''} />Apify <b>{configured(data.providerStatus?.apify) ? 'Connected' : 'Public pages available'}</b></span><span><i className={configured(data.providerStatus?.model || data.providerStatus?.groq) ? 'connected' : ''} />Model <b>{configured(data.providerStatus?.model || data.providerStatus?.groq) ? 'Connected' : 'Rules engine available'}</b></span></div><button className="button button-secondary button-small" onClick={() => setSettingsOpen(true)}>Connect providers <Icon name="link" size={14} /></button></div><button className="button button-primary" onClick={() => setImportOpen(true)}>Let&apos;s make an introduction <Icon name="arrow" size={17} /></button></>}{demoMode && <button className="button button-primary demo-own-button" onClick={tryOwnLinks}>Try your own links <Icon name="arrow" size={17} /></button>}</section>}

      <footer className="main-footer"><span>after hours <span>·</span> Connection starts with curiosity.</span><button onClick={shareDemo}>Share the saved example <span>↗</span></button></footer>
    </main>
    {shareLink && <Modal title="Pass the good company on." description="This link opens the saved example, ready to explore." onClose={() => setShareLink('')}><label className="field-label" htmlFor="share-link">Saved demo link</label><div className="input-wrap"><input id="share-link" value={shareLink} readOnly onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} /></div><p className="field-help">Select the link and copy it to share the same completed profiles and conversations.</p><button className="button button-primary button-full" onClick={() => setShareLink('')}>Done <Icon name="check" size={16} /></button></Modal>}
    {toast && <div className="toast" role="status"><span><Icon name="check" size={17} /></span>{toast}<button className="icon-button" onClick={() => setToast('')} aria-label="Dismiss notification"><Icon name="close" size={16} /></button></div>}
    {!demoMode && settingsOpen && <SettingsModal status={data.providerStatus} onClose={() => setSettingsOpen(false)} onSave={async () => { await load(); setToast('Connections saved. Your workspace is ready.'); }} />}
    {!demoMode && importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={importPerson} busy={busy === 'import'} />}
    {!demoMode && dateOpen && <DateModal people={readyPeople} onClose={() => setDateOpen(false)} onStart={startDate} busy={busy === 'date'} />}
    {selectedProfile && <ProfileModal readOnly={demoMode || Boolean(profileSnapshot)} contextLabel={profileSnapshot ? "Source analysis saved for this date" : undefined} person={selectedProfile} onClose={closeProfile} onAnalyze={() => { if (selectedProfile.status === 'failed' && selectedProfile.sources.filter(source => source.status === 'ready').length < 2) { importPerson(selectedProfile.linkedinUrl, selectedProfile.instagramUrl).catch(cause => setError(cause.message)); } else { analyze(selectedProfile.id); } }} onMatches={() => openMatches(selectedProfile.id)} busy={busy === `analyze-${selectedProfile.id}` || busy === 'import'} />}
  </div>;
}
