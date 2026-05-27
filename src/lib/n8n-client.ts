/**
 * n8n webhook client — proxy ADV endpoints (Phase 1).
 *
 * En Phase 2, ces appels seront remplacés par de la logique TS directe
 * (Pennylane / Firma / Supabase) dans le CRM (cf. décision archi 23/05).
 *
 * Base URL: process.env.N8N_WEBHOOK_BASE_URL — ex. https://n8n.ldg-automation.com
 * Pour dev local Teina: https://n8n.n8n-teina.shop
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_5XX_MAX = 1;

export type N8nWebhookPath =
  | "lca-devis-a-envoyer"
  | "invoice-from-deal"
  | "firma-signed"
  | "quote-signed-invoice-supabase";

export interface N8nWebhookResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

export class N8nWebhookError extends Error {
  constructor(
    public readonly path: N8nWebhookPath,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "N8nWebhookError";
  }
}

function getBaseUrl(): string {
  const url = process.env.N8N_WEBHOOK_BASE_URL;
  if (!url) {
    throw new N8nWebhookError(
      "lca-devis-a-envoyer",
      0,
      "N8N_WEBHOOK_BASE_URL env var manquante. Configurer dans .env.local.",
    );
  }
  return url.replace(/\/$/, "");
}

async function postOnce<T>(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<N8nWebhookResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: T | null = null;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? undefined : `n8n responded with ${res.status}: ${text || "no body"}`,
    };
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 0,
      data: null,
      error: isAbort
        ? `n8n webhook timeout après ${timeoutMs}ms`
        : `n8n webhook fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Déclenche un webhook n8n avec retry 1x sur 5xx ou timeout.
 *
 * @example
 * const r = await triggerN8nWebhook("lca-devis-a-envoyer", { dealId });
 * if (!r.ok) throw new N8nWebhookError("lca-devis-a-envoyer", r.status, r.error!);
 */
export async function triggerN8nWebhook<T = unknown>(
  path: N8nWebhookPath,
  body: Record<string, unknown>,
  options: { timeoutMs?: number } = {},
): Promise<N8nWebhookResult<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${getBaseUrl()}/webhook/${path}`;

  let result = await postOnce<T>(url, body, timeoutMs);
  if (!result.ok && (result.status >= 500 || result.status === 0)) {
    for (let i = 0; i < RETRY_5XX_MAX; i++) {
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      result = await postOnce<T>(url, body, timeoutMs);
      if (result.ok) break;
    }
  }
  return result;
}
