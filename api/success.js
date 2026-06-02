module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>アップグレード完了 - 推し通知</title>
  <style>
    body { background:#0e0e10; color:#efeff1; font-family:-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; text-align:center; }
    .card { background:#18181b; border:1px solid #26262c; border-radius:12px; padding:40px 48px; }
    h1 { color:#bf94ff; font-size:24px; margin-bottom:12px; }
    p { color:#adadb8; line-height:1.7; margin-bottom:20px; }
    .badge { background:#9147ff22; border:1px solid #9147ff; color:#bf94ff; padding:4px 14px; border-radius:20px; font-size:13px; font-weight:700; display:inline-block; margin-bottom:24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Pro プラン</div>
    <h1>アップグレード完了！</h1>
    <p>推し通知 Proへようこそ。<br>拡張機能を再起動するとProプランが反映されます。</p>
    <p style="color:#6e6e8a;font-size:13px">このタブは閉じて構いません。</p>
  </div>
</body>
</html>`);
};
