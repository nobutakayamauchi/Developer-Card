export function encodePublicReport(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodePublicReport(token) {
  if (!token) return null;
  try {
    const base64 = String(token).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload?.v === 1 ? payload : null;
  } catch {
    return null;
  }
}

export function buildPublicReportUrl(payload, href = globalThis.location?.href || '') {
  const url = new URL(href || 'https://example.invalid/');
  url.search = '';
  url.hash = `report=${encodePublicReport(payload)}`;
  return url.toString();
}

export function readPublicReportFromLocation(locationLike = globalThis.location) {
  const hash = String(locationLike?.hash || '').replace(/^#/, '');
  if (!hash.startsWith('report=')) return null;
  return decodePublicReport(hash.slice('report='.length));
}
