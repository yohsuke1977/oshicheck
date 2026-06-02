// POST /api/webhook  (Stripe webhook)
// Handles checkout.session.completed → sets plan to 'pro' in Firestore
// Handles customer.subscription.deleted → sets plan back to 'free'

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initAdmin } = require('./_firebase-admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  const admin = initAdmin();
  const db = admin.firestore();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    if (uid) {
      await db.doc(`users/${uid}/subscription/plan`).set({
        value: 'pro',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    // customerId → uid を逆引き
    const snapshot = await db.collectionGroup('subscription')
      .where('stripeCustomerId', '==', sub.customer)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.set({
        value: 'free',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  res.json({ received: true });
};

// Stripeはraw bodyが必要
module.exports.config = { api: { bodyParser: false } };
