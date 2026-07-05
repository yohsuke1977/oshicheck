// GET /api/portal?token=xxx
// Verifies Firebase ID token, looks up the Stripe customer, opens the
// Stripe Billing Portal so the user can manage / cancel their subscription.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initAdmin } = require('./_firebase-admin');

module.exports = async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send('パラメータが不足しています');

  const admin = initAdmin();

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch (e) {
    return res.status(401).send('認証エラーです。拡張機能からやり直してください。');
  }

  try {
    const db = admin.firestore();
    const snap = await db.doc(`users/${uid}/subscription/plan`).get();
    const customerId = snap.exists ? snap.data().stripeCustomerId : null;

    if (!customerId) {
      return res.status(404).send('サブスクリプション情報が見つかりませんでした。');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.BASE_URL}/api/cancel`
    });
    res.redirect(303, session.url);
  } catch (e) {
    console.error('Portal error:', e.message);
    res.status(500).send(`エラー: ${e.message}`);
  }
};
