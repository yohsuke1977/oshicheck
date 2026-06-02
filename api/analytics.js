// POST /api/analytics
// Body: { client_id, name, params }
// Proxies event to GA4 Measurement Protocol

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { client_id, name, params = {} } = req.body || {};
  if (!client_id || !name) return res.status(400).end();

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id, events: [{ name, params }] })
      }
    );
  } catch (e) {
    // Analytics failure should never affect users
  }

  res.status(204).end();
};
