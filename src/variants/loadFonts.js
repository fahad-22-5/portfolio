// Preview pages need their own Google Fonts; index.html only loads the live site's.
export default function loadFonts(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
