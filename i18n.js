// i18nヘルパー（popup/options共通）。
// HTML側は data-i18n（textContent）/ data-i18n-placeholder / data-i18n-title 属性で宣言し、
// applyI18n() が _locales のメッセージで置き換える。Chrome UIの言語で自動選択される。

function t(key, subs) {
  return chrome.i18n.getMessage(key, subs) || key;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  const titleKey = document.documentElement.dataset.i18nDoctitle;
  if (titleKey) document.title = t(titleKey);
}

applyI18n();
