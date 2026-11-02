import { useCallback, useEffect, useState } from 'react';
import { getAudit, getCerts, renew, scan } from './api.js';

const fmtDays = (d) => (d == null ? '-' : d < 1 ? `${(d * 24).toFixed(1)} h` : `${d.toFixed(1)} d`);

function Summary({ certs }) {
  const count = (s) => certs.filter((c) => c.status === s).length;
  const items = [['Total', certs.length, 'total'], ['Healthy', count('ok'), 'ok'], ['Expiring', count('expiring'), 'expiring'],
    ['Expired / unreachable', count('expired') + count('unreachable'), 'bad']];
  return (
    <div className="cards">
      {items.map(([label, n, cls]) => (
        <div key={label} className={`card ${cls}`}><div className="n">{n}</div><div>{label}</div></div>
      ))}
    </div>
  );
}

function CertTable({ certs, busy, onRenew }) {
  return (
    <table>
      <thead><tr><th>Name</th><th>Domain</th><th>Endpoint</th><th>Status</th><th>Time left</th><th>Expires</th><th>Serial</th><th /></tr></thead>
      <tbody>
        {certs.map((c) => (
          <tr key={c.name}>
            <td>{c.name}</td><td>{c.domain}</td><td>{c.host}:{c.port}</td>
            <td><span className={`badge ${c.status}`}>{c.status}</span></td>
            <td>{fmtDays(c.days_left)}</td>
            <td>{c.not_after ? new Date(c.not_after).toLocaleString() : '-'}</td>
            <td className="mono">{c.serial ? c.serial.slice(0, 12) : '-'}</td>
            <td><button disabled={busy} onClick={() => onRenew(c.name)}>Renew now</button></td>
          </tr>
        ))}
        {certs.length === 0 && <tr><td colSpan="8">No targets yet.</td></tr>}
      </tbody>
    </table>
  );
}

function AuditTable({ rows }) {
  return (
    <table>
      <thead><tr><th>Time</th><th>Target</th><th>Action</th><th>Detail</th></tr></thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}><td>{new Date(a.ts).toLocaleTimeString()}</td><td>{a.name}</td><td><b>{a.action}</b></td><td>{a.detail}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const [certs, setCerts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    try { setCerts(await getCerts()); setAudit(await getAudit()); } catch (e) { setMsg(`Error: ${e.message}`); }
  }, []);

  useEffect(() => { refresh(); const id = setInterval(refresh, 4000); return () => clearInterval(id); }, [refresh]);

  const act = async (label, fn) => {
    setBusy(true); setMsg(`${label}...`);
    try { const r = await fn(); setMsg(`${label}: ${JSON.stringify(r)}`); } catch (e) { setMsg(`Error: ${e.message}`); }
    setBusy(false); refresh();
  };

  return (
    <main>
      <h1>CertRotator</h1>
      <p className="sub">Discover, renew, deploy and verify TLS certificates automatically.</p>
      <Summary certs={certs} />
      <div className="actions">
        <button disabled={busy} onClick={() => act('Scan', scan)}>Scan now</button>
        <button disabled={busy} onClick={() => act('Renew due', () => renew())}>Renew due</button>
        <button disabled={busy} className="warn" onClick={() => act('Force renew all', () => renew({ force: true }))}>Force renew all</button>
      </div>
      {msg && <div className="msg">{msg}</div>}
      <h2>Certificates</h2>
      <CertTable certs={certs} busy={busy} onRenew={(name) => act(`Renew ${name}`, () => renew({ name, force: true }))} />
      <h2>Audit trail</h2>
      <AuditTable rows={audit} />
    </main>
  );
}
