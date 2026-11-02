export async function sendAlert(cfg, message) {
  console.warn(`ALERT: ${message}`);
  if (!cfg.alertWebhook) return;
  try { // Slack / Teams style payload
    await fetch(cfg.alertWebhook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }), signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error('webhook failed:', e.message);
  }
}
