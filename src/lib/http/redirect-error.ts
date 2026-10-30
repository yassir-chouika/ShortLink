import 'server-only';
import { createHash } from 'node:crypto';
import { jsonError, NO_STORE_HEADERS } from './responses';

type ErrorStatus = 403 | 404 | 503;
const errors = {
  403: {
    code: 'DESTINATION_BLOCKED',
    message: 'This short link is not available.',
    title: 'This link isn’t available.',
    description:
      'This destination is unavailable on Shrtnr. Ask the person who shared the link for another way to reach it.',
    label: 'LINK UNAVAILABLE',
  },
  404: {
    code: 'LINK_NOT_FOUND',
    message: 'This short link could not be found.',
    title: 'This link is missing.',
    description:
      'It may have been removed, or the short code may be incorrect. Check the link with the person who shared it.',
    label: 'A LITTLE DETOUR',
  },
  503: {
    code: 'LINK_UNAVAILABLE',
    message:
      'This short link is temporarily unavailable. Please try again later.',
    title: 'A short pause.',
    description:
      'We can’t open this link right now. Please try again in a moment.',
    label: 'PLEASE TRY AGAIN',
  },
} satisfies Record<
  ErrorStatus,
  {
    code: string;
    message: string;
    title: string;
    description: string;
    label: string;
  }
>;

/** Prefer explicit HTML; JSON wins an equal-quality explicit representation tie. */
export function prefersHtml(accept: string | null): boolean {
  const entries = (accept ?? '').split(',').map((part) => {
    const [media, ...parameters] = part.trim().toLowerCase().split(';');
    const quality = parameters
      .map((parameter) =>
        parameter
          .trim()
          .split('=')
          .map((value) => value.trim()),
      )
      .find(([name]) => name === 'q')?.[1];
    const q =
      quality === undefined
        ? 1
        : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality)
          ? Number(quality)
          : 0;
    return { media: media.trim(), q };
  });
  const qualityOf = (media: string) => {
    const matches = entries.filter((entry) => entry.media === media);
    return matches.length ? Math.max(...matches.map((entry) => entry.q)) : null;
  };
  const html = qualityOf('text/html') ?? 0;
  const explicitJson = qualityOf('application/json');
  const json =
    explicitJson ?? qualityOf('application/*') ?? qualityOf('*/*') ?? 0;
  return html > 0 && (html > json || (html === json && explicitJson === null));
}

const css = `
*{box-sizing:border-box}
html{color-scheme:light;background:#fafaf7;color:#1c1917;font-family:Arial,Helvetica,sans-serif}
body{margin:0}
.shell{max-width:1152px;min-height:100svh;margin:auto;padding:0 24px;display:flex;flex-direction:column}
header{padding:28px 0;border-bottom:1px solid #d6d3d1}
.brand{font-size:30px;font-weight:700;letter-spacing:-1.5px;color:#1c1917;text-decoration:none}
.brand span{color:#065f46}
main{flex:1;display:grid;align-content:center;gap:40px;padding:64px 0}
.number{width:176px;height:176px;display:grid;place-items:center;background:#e6ecdf;border:1px solid #bacbbb;color:#064e3b;font-family:monospace;font-size:64px;letter-spacing:-4px;border-radius:20px}
.eyebrow{font-family:monospace;font-size:12px;letter-spacing:1px;color:#065f46}
h1{max-width:640px;font-size:clamp(36px,6vw,64px);font-weight:600;line-height:1.08;letter-spacing:-2px;margin:16px 0 20px}
.description{max-width:510px;font-size:18px;line-height:1.65;color:#57534e;margin:0}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin-top:32px}
.primary{display:inline-flex;min-height:48px;align-items:center;padding:12px 20px;background:#064e3b;color:white;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600}
.primary:hover{background:#022c22}
.secondary{display:inline-flex;min-height:44px;align-items:center;color:#064e3b;font-size:14px;font-weight:600;text-underline-offset:4px}
footer{border-top:1px solid #d6d3d1;padding:24px 0;font-size:13px;color:#57534e}
a:focus-visible{outline:3px solid #047857;outline-offset:4px}
.skip{position:fixed;left:-10000px;top:16px;z-index:10;background:#064e3b;color:white;padding:12px 16px;border-radius:8px}
.skip:focus{left:16px}
::selection{background:#a7f3d0;color:#064e3b}
@media(min-width:768px){.shell{padding:0 40px}
main{grid-template-columns:224px 1fr;gap:56px;padding:100px 0}
.number{width:224px;height:224px;font-size:88px}
}

`;
const styleHash = createHash('sha256').update(css).digest('base64');

/** Fixed copy only: request URLs, destinations, and exceptions never enter HTML. */
export function redirectError(request: Request, status: ErrorStatus): Response {
  const error = errors[status];
  const commonHeaders = {
    ...NO_STORE_HEADERS,
    Vary: 'Accept',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  };
  if (!prefersHtml(request.headers.get('accept'))) {
    const response = jsonError(status, error.code, error.message);
    for (const [name, value] of Object.entries(commonHeaders))
      response.headers.set(name, value);
    return response;
  }
  const actions =
    status === 503
      ? '<a class="primary" href="">Try again</a><a class="secondary" href="/">Back to Shrtnr.</a>'
      : '<a class="primary" href="/">Back to Shrtnr. <span aria-hidden="true">&nbsp;↗</span></a>';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><link rel="icon" href="data:,"><title>${error.title} | Shrtnr.</title><style>${css}</style></head><body><a class="skip" href="#main-content">Skip to content</a><div class="shell"><header><a class="brand" href="/" aria-label="Shrtnr. home">Shrtnr<span>.</span></a></header><main id="main-content" tabindex="-1"><div class="number" aria-hidden="true">${status}</div><div><p class="eyebrow">${error.label}</p><h1>${error.title}</h1><p class="description">${error.description}</p><div class="actions">${actions}</div></div></main><footer>Small links. Thoughtfully made.</footer></div></body></html>`;
  return new Response(html, {
    status,
    headers: {
      ...commonHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'sha256-${styleHash}'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
    },
  });
}
