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
    // Stripeの生メッセージは英語かつ customer ID を含むので、そのままユーザーに見せない。
    // 詳細はサーバーログにだけ残す。
    console.error('Portal error:', e.type, e.code, e.message);

    // 保存済みの customer がStripe側に存在しない（テストモードで作られた記録が
    // 本番キーで参照された場合など）。ユーザー側では復旧できないので問い合わせに誘導する。
    if (e.code === 'resource_missing') {
      return res.status(404).send(
        'お支払い情報が確認できませんでした。お手数ですが、設定画面のフィードバックフォームからご連絡ください。'
      );
    }

    res.status(500).send('管理画面を開けませんでした。時間をおいて再度お試しください。');
  }
};
