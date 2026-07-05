import i18n from "@/lib/i18n";
import { getHtmlLang, getTextDirection, normalizeAppLanguage } from "@/lib/locale";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

export function renderErrorPage(): string {
  const language = normalizeAppLanguage(i18n.language);
  const title = escapeHtml(i18n.t("errors.pageLoad.title"));
  const description = escapeHtml(i18n.t("errors.pageLoad.description"));
  const retry = escapeHtml(i18n.t("common.retry"));
  const goHome = escapeHtml(i18n.t("errors.actions.goHome"));

  return `<!doctype html>
<html lang="${getHtmlLang(language)}" dir="${getTextDirection(language)}">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${description}</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">${retry}</button>
        <a class="secondary" href="/">${goHome}</a>
      </div>
    </div>
  </body>
</html>`;
}
