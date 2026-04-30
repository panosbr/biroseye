// Δυναμική επιλογή endpoint ανάλογα με το δίκτυο.
// Δοκιμάζει τοπικό LAN, Tailscale, και public DDNS με αυτή τη σειρά.
// Αποθηκεύει σε cache το πρώτο που απάντησε.

const ENDPOINTS = [
  'http://192.168.1.5:8501',       // Local LAN (μέσα στο κατάστημα)
  'http://100.76.147.120:8501',    // Tailscale VPN
  'https://photodrama.synology.me', // Public DDNS (fallback)
];

let _cachedBase = null;
let _lastCheck = 0;
const CACHE_TTL = 60 * 1000; // 1 λεπτό

async function _pingEndpoint(url, timeoutMs = 2500) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${url}/api/eyebiros/ping`, {
      method: 'GET',
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return false;
    // Επαλήθευση: πρέπει να έχει {"ok":true} — όχι απλά οποιαδήποτε 200 response
    // (π.χ. router admin page μπορεί να κλέψει το 192.168.1.5 σε 4G CGNAT)
    const data = await res.json();
    return data && data.ok === true;
  } catch (e) {
    return false;
  }
}

async function _detectBase() {
  // Δοκίμασε όλα parallel, πάρε το πρώτο που απαντά
  const results = await Promise.allSettled(
    ENDPOINTS.map(async (url) => {
      const ok = await _pingEndpoint(url);
      if (!ok) throw new Error('not reachable');
      return url;
    })
  );
  // Προτίμηση στη σειρά που ορίσαμε (local > tailscale > public)
  for (let i = 0; i < ENDPOINTS.length; i++) {
    if (results[i].status === 'fulfilled') {
      console.log('[baseUrl] Επιλέχθηκε:', ENDPOINTS[i]);
      return ENDPOINTS[i];
    }
  }
  // Fallback: το τελευταίο (public)
  console.warn('[baseUrl] Κανένα endpoint δεν απαντά, fallback σε:', ENDPOINTS[ENDPOINTS.length - 1]);
  return ENDPOINTS[ENDPOINTS.length - 1];
}

export async function getBaseUrl() {
  const now = Date.now();
  if (_cachedBase && (now - _lastCheck) < CACHE_TTL) {
    return _cachedBase;
  }
  _cachedBase = await _detectBase();
  _lastCheck = now;
  return _cachedBase;
}

// Δίνει τρέχον base χωρίς detect — για perf-sensitive calls μετά το login
export function getCachedBaseUrl() {
  return _cachedBase || ENDPOINTS[ENDPOINTS.length - 1];
}

// Ακυρώνει το cache (π.χ. αν υπάρξει error, στην επόμενη κλήση ξαναδοκιμάζει)
export function invalidateBaseUrl() {
  _cachedBase = null;
  _lastCheck = 0;
}
