module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>キャンセル - 推し通知</title>
  <style>
    body { background:#0e0e10; color:#efeff1; font-family:-apple-system,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; text-align:center; }
    .card { background:#18181b; border:1px solid #26262c; border-radius:12px; padding:40px 48px; }
    h1 { font-size:20px; margin-bottom:12px; }
    p { color:#adadb8; line-height:1.7; }
  </style>
</head>
<body>
  <div class="card">
    <h1>決済をキャンセルしました</h1>
    <p>このタブを閉じて拡張機能に戻ってください。</p>
  </div>
</body>
</html>`);
};
