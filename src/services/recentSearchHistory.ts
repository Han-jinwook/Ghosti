const RECENT_SEARCHES_STORAGE_KEY = 'ghosti_recent_searches_v1';
const MAX_RECENT_SEARCHES = 5;

export function loadRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function pushRecentSearch(query: string): string[] {
  const clean = String(query || '').trim();
  if (!clean || typeof window === 'undefined') return loadRecentSearches();
  const prev = loadRecentSearches();
  const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
    0,
    MAX_RECENT_SEARCHES
  );
  try {
    window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage quota */
  }
  return next;
}
