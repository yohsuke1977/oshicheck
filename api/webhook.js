// POST /api/webhook  (Stripe webhook)
// Handles checkout.session.completed → sets plan to 'pro' in Firestore
// Handles customer.subscription.deleted → sets plan back to 'free'

const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initAdmin } = require('./_firebase-admin');

// 本番とテスト(サンドボックス)で署名シークレットは別物。両方を受け付ける。
// 片方しか持たないと、もう片方のモードの配信が毎回400になり、
// Stripeがリトライを繰り返した末にエンドポイントを自動で無効化する。
const WEBHOOK_SECRETS = [
  process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_WEBHOOK_SECRET_TEST,
].filter(Boolean);

// シークレットの指紋（sha256の先頭8桁）。値そのものはログに出さずに
// 「どの鍵を試したか」だけ後から追えるようにするため。
const fingerprint = (sec) => crypto.createHash('sha256').update(sec).digest('hex').slice(0, 8);

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const rawBody = await getRawBody(req);

  if (WEBHOOK_SECRETS.length === 0) {
    console.error('STRIPE_WEBHOOK_SECRET が未設定です');
    return res.status(500).send('Webhook secret not configured');
  }

  // 登録されているシークレットを順に試す。1本でも通れば正当なイベント。
  let event = null;
  let lastError = null;
  for (const secret of WEBHOOK_SECRETS) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!event) {
    console.error(
      'Webhook signature error:', lastError && lastError.message,
      '| 試したシークレット:', WEBHOOK_SECRETS.map(fingerprint).join(', ')
    );
    return res.status(400).send(`Webhook Error: ${lastError && lastError.message}`);
  }

  // テスト用シークレットでも署名は通す（配信失敗を積み上げてエンドポイントを
  // 無効化されないため）が、Firestoreの書き換えは本番イベントに限る。
  // これが無いと、テスト用シークレットを知っている者が metadata.uid を仕込んだ
  // 偽イベントを送るだけで、任意のユーザーをProにできてしまう。
  if (!event.livemode) {
    console.log('テストモードのイベントのため状態を変更せず受理:', event.type, event.id);
    return res.json({ received: true, testMode: true });
  }

  const admin = initAdmin();
  const db = admin.firestore();

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.uid;
    // 同一Stripeアカウントを他プロダクト（NineCut・レジあと・Leaguru）と共有しているため、
    // 推し通知宛でないcheckoutもここへ届く。uidが無いものは黙って200で受け流す。
    if (uid) {
      console.log('checkout.session.completed uid:', uid, 'livemode:', event.livemode);
      await db.doc(`users/${uid}/subscription/plan`).set({
        value: 'pro',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      console.log('推し通知以外のcheckoutのためスキップ:', session.id, 'livemode:', event.livemode);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
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

module.exports.config = { api: { bodyParser: false } };
