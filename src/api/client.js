import { getBaseUrl, getCachedBaseUrl, invalidateBaseUrl } from './endpoint';

// Helper: wrap fetch με dynamic base + retry
async function _fetch(pathFn, options) {
  let base = await getBaseUrl();
  try {
    return await fetch(pathFn(base), options);
  } catch (e) {
    console.warn('[client] fetch failed, re-detecting endpoint:', e);
    invalidateBaseUrl();
    base = await getBaseUrl();
    return fetch(pathFn(base), options);
  }
}

// v1.0.96: Safe JSON parser — αν response είναι HTML (404/500), επιστρέφει diagnostic object
async function _safeJson(response) {
  let text;
  try {
    text = await response.text();
  } catch (e) {
    return { ok: false, error: 'Read response failed: ' + (e.message || e) };
  }
  if (!text) {
    return { ok: false, error: 'Empty response body (HTTP ' + response.status + ')' };
  }
  // Detect HTML
  const trimmed = text.trim();
  if (trimmed.startsWith('<')) {
    const snippet = trimmed.substring(0, 200).replace(/\n/g, ' ');
    return {
      ok: false,
      error: 'Server returned HTML (HTTP ' + response.status + '): ' + snippet
    };
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      error: 'Invalid JSON (HTTP ' + response.status + '): ' + text.substring(0, 200)
    };
  }
}

export const apiAuth = async (pin) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/auth`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }
  );
  return _safeJson(r);
};

export const apiGetItem = async (qrToken, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/item/${qrToken}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiGetCart = async (authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiAddToCart = async (data, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/add`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify(data) }
  );
  return _safeJson(r);
};

export const apiRemoveFromCart = async (id, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/${id}`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiClearCart = async (authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/clear`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiAddCustomItem = async (item, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/add-custom`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify(item) }
  );
  return _safeJson(r);
};

export const apiSaveQuote = async (data, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quote/save`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify(data) }
  );
  return _safeJson(r);
};

export const apiGetDiscount = async (authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/discount`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiSetDiscount = async (pct, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/discount`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify({ discount_pct: pct }) }
  );
  return _safeJson(r);
};

export const apiLogout = async (authToken) => {
  try {
    await _fetch(
      (b) => `${b}/api/eyebiros/logout`,
      { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } }
    );
  } catch (e) {}
};

export const apiSetItemDiscount = async (itemId, pct, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/item-discount`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify({ item_id: itemId, discount_pct: pct }) }
  );
  return _safeJson(r);
};

// v1.0.93: Custom price ανά cart item — ίδια λογική με Inshop v1.2.708
export const apiSetItemPrice = async (itemId, priceInst, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/cart/set-price`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ item_id: itemId, price_inst: priceInst })
    }
  );
  return _safeJson(r);
};

export const apiGetQuotes = async (params, authToken) => {
  const q = new URLSearchParams(params || {}).toString();
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quotes${q ? '?' + q : ''}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiGetQuoteDetail = async (qid, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quote/${qid}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiDeleteQuote = async (qid, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quote/${qid}/delete`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiQuoteToOrder = async (qid, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quote/${qid}/to-order`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

export const apiQuotePdf = async (qid, authToken) => {
  const b = getCachedBaseUrl();
  return `${b}/api/eyebiros/quote/${qid}/pdf?token=${authToken}`;
};

export const apiQuoteEmail = async (qid, email, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quote/${qid}/email`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }, body: JSON.stringify({ email }) }
  );
  return _safeJson(r);
};

export const apiQuotePrint = async (qid) => {
  const b = getCachedBaseUrl();
  return `${b}/showroom/quote/${qid}/print`;
};

export const fetchQuotePdf = async (qid, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quote/${qid}/pdf`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  if (!r.ok) throw new Error('PDF fetch failed');
  return r.blob();
};

export const fetchQuoteHtml = async (qid, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/quote/${qid}/html`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  if (!r.ok) throw new Error('HTML fetch failed');
  const data = await _safeJson(r);
  return data.html || '';
};

// v1.0.99: Customer search/details (mirror of Inshop autocomplete)
export const apiSearchCustomers = async (query, authToken, field = '') => {
  if (!query || query.length < 2) return [];
  const fieldParam = field ? `&field=${encodeURIComponent(field)}` : '';
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/customers/search?q=${encodeURIComponent(query)}${fieldParam}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  const data = await _safeJson(r);
  // Returns array directly, or {ok:false} on error
  if (Array.isArray(data)) return data;
  return [];
};

export const apiCustomerDetails = async (customerId, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/eyebiros/customers/${customerId}/details`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

// ════════════════════════════════════════════════════════════════════
// v1.0.94: Payment Schedule (Δοσολόγιο) — full feature parity με Inshop
// ════════════════════════════════════════════════════════════════════

// Live calculation (no DB save) — επιστρέφει installments preview
export const apiSchedCalculate = async (params, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/calculate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify(params)
    }
  );
  return _safeJson(r);
};

// Υπολογισμός έξτρα τόκου για έντοκο πάνω από threshold
export const apiSchedExtraInterest = async (params, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/extra-interest`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify(params)
    }
  );
  return _safeJson(r);
};

// Φέρνει τις τρέχουσες ρυθμίσεις τόκου (threshold + rate)
export const apiSchedInterestSettings = async (authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/interest-settings`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

// Default ημερομηνία έναρξης
export const apiSchedDefaultStart = async (authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/default-start`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

// Festive months check στο διάστημα (επιστρέφει ποια γιορτή πέφτει σε ποιο μήνα)
export const apiSchedFestiveCheck = async (start_date, months, authToken) => {
  const q = new URLSearchParams({ start_date, months: String(months) }).toString();
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/festive-check?${q}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

// Save schedule σε quote (καλείται μετά την αποθήκευση προσφοράς)
export const apiSchedSave = async (params, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify(params)
    }
  );
  return _safeJson(r);
};

// Φέρνει όλα τα schedules μιας προσφοράς (interest + interest_free)
export const apiSchedByQuote = async (qid, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/by-quote/${qid}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

// ─── v1.0.94: Draft schedules (cart-bound) — sync με Inshop ─────────

// Αποθήκευση draft στη DB (auto-sync με Inshop)
export const apiSchedDraftSave = async (params, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/draft/save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify(params)
    }
  );
  return _safeJson(r);
};

// Φόρτωμα drafts του τρέχοντος χρήστη
export const apiSchedDraftGet = async (authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/draft`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

// Διαγραφή draft (optional type=interest|interest_free)
export const apiSchedDraftDelete = async (authToken, type = null) => {
  const url = type
    ? `/api/payment-schedule/draft?type=${encodeURIComponent(type)}`
    : `/api/payment-schedule/draft`;
  const r = await _fetch(
    (b) => `${b}${url}`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } }
  );
  return _safeJson(r);
};

// Μετατροπή drafts σε attached schedules σε quote (μετά save quote)
export const apiSchedDraftAttach = async (quoteId, authToken) => {
  const r = await _fetch(
    (b) => `${b}/api/payment-schedule/draft/attach`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ quote_id: quoteId })
    }
  );
  return _safeJson(r);
};
