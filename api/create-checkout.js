// GET /api/create-checkout?uid=xxx&token=xxx
// Verifies Firebase ID token, creates Stripe checkout session, redirects to Stripe

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initAdmin } = require('./_firebase-admin');

module.exports = async function handler(req, res) {
  const { uid, token } = req.query;
  if (!uid || !token) return res.status(400).send('パラメータが不足しています');

  const admin = initAdmin();

  try {
    await admin.auth().verifyIdToken(token);
  } catch (e) {
    return res.status(401).send('認証エラーです。拡張機能からやり直してください。');
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.BASE_URL}/api/success`,
      cancel_url: `${process.env.BASE_URL}/api/cancel`,
      metadata: { uid },
      locale: 'ja'
    });
    res.redirect(303, session.url);
  } catch (e) {
    console.error('Stripe error:', e.message, e.type, e.code);
    res.status(500).send(`決済エラー: ${e.message}`);
  }
};
