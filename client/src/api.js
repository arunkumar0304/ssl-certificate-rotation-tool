const json = async (res) => {
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
};
export const getCerts = () => fetch('/api/certs').then(json);
export const getAudit = (limit = 20) => fetch(`/api/audit?limit=${limit}`).then(json);
export const scan = () => fetch('/api/scan', { method: 'POST' }).then(json);
export const renew = ({ name, force = false } = {}) => {
  const q = new URLSearchParams({ force: String(force), ...(name ? { name } : {}) });
  return fetch(`/api/renew?${q}`, { method: 'POST' }).then(json);
};
