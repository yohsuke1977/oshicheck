// Firebase Admin SDKの初期化（複数のAPI関数で共有）
let adminApp = null;

function initAdmin() {
  const admin = require('firebase-admin');
  if (!adminApp) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      })
    });
  }
  return admin;
}

module.exports = { initAdmin };
