/**
 * Firma.dev client — signature électronique (port ADV intra-CRM, Phase 2).
 *
 * Remplace l'étape signature de WF-002b (anciennement Documenso 5-call,
 * désormais 1 call atomic create-and-send).
 * Spec de référence : closing-academy/.claude/rules/firma-api.md
 *
 * Auth : header `Authorization: <workspace_api_key>` (workspace LCA isolé,
 * PAS la protected root key). Env var FIRMA_WORKSPACE_API_KEY.
 *
 * Traçabilité : pas de metadata field libre au niveau signing request →
 * on embed `LCA-DEAL-{deal_id}` dans le `name` (parse via regex côté webhook).
 */

const DEFAULT_BASE_URL = "https://api.firma.dev/functions/v1/signing-request-api";
const DEFAULT_TIMEOUT_MS = 20_000;

export class FirmaError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "FirmaError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FirmaRecipient {
  firstName: string;
  lastName: string;
  email: string;
}

export interface CreateAndSendInput {
  /** Doit embarquer "LCA-DEAL-{deal_id}" pour la traçabilité webhook. */
  name: string;
  description?: string;
  /** PDF encodé en base64 (max 20 MB). */
  documentBase64: string;
  recipient: FirmaRecipient;
  /** Texte d'ancrage de la zone signature dans le PDF. */
  anchorString?: string;
  expirationHours?: number;
}

export interface FirmaSigningRequest {
  id: string;
  name: string;
  status: string;
  first_signer?: {
    id: string;
    name: string;
    email: string;
    signing_link: string;
  };
  credits_remaining?: number;
}

/** Zone signature standard du devis PDF LCA. */
const DEFAULT_ANCHOR_STRING = "Date et signature précédées de";

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

function getConfig(): { baseUrl: string; apiKey: string } {
  const apiKey = process.env.FIRMA_WORKSPACE_API_KEY;
  if (!apiKey) {
    throw new FirmaError(
      0,
      "(config)",
      "FIRMA_WORKSPACE_API_KEY env var manquante. Configurer dans .env.local.",
    );
  }
  return {
    baseUrl: (process.env.FIRMA_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    apiKey,
  };
}

async function firmaFetch<T>(
  endpoint: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init;
  const { baseUrl, apiKey } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        ...fetchInit.headers,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new FirmaError(
        res.status,
        endpoint,
        `Firma ${res.status} sur ${endpoint}: ${text || "no body"}`,
        text,
      );
    }
    return (text ? JSON.parse(text) : null) as T;
  } catch (e) {
    if (e instanceof FirmaError) throw e;
    const isAbort = e instanceof Error && e.name === "AbortError";
    throw new FirmaError(
      0,
      endpoint,
      isAbort
        ? `Firma timeout après ${timeoutMs}ms sur ${endpoint}`
        : `Firma fetch failed sur ${endpoint}: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Create & send (atomic)
// ---------------------------------------------------------------------------

/**
 * POST /signing-requests/create-and-send — crée + envoie l'email signature
 * en un seul call. PDF inline base64, zone signature via anchor_tags (%).
 */
export async function createAndSendSigningRequest(
  input: CreateAndSendInput,
): Promise<FirmaSigningRequest> {
  const body = {
    name: input.name,
    description: input.description,
    document: input.documentBase64,
    expiration_hours: input.expirationHours ?? 168,
    recipients: [
      {
        id: "temp_signer_1",
        first_name: input.recipient.firstName,
        last_name: input.recipient.lastName,
        email: input.recipient.email,
        designation: "Signer",
        order: 1,
      },
    ],
    anchor_tags: [
      {
        anchor_string: input.anchorString ?? DEFAULT_ANCHOR_STRING,
        type: "signature",
        recipient_id: "temp_signer_1",
        x_offset: 0,
        y_offset: 3,
        offset_units: "percent",
        width: 30,
        height: 6,
        case_sensitive: false,
        match_whole_word: false,
        ignore_if_not_present: false,
        required: true,
      },
    ],
    settings: {
      send_signing_email: true,
      send_finish_email: true,
      allow_download: true,
      attach_pdf_on_finish: true,
    },
  };

  return firmaFetch<FirmaSigningRequest>("/signing-requests/create-and-send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export interface FirmaSignedEvent {
  type: string;
  data: {
    signing_request: {
      id: string;
      name: string;
      completed_at?: string;
    };
    recipients: { id: string; email: string; name: string; signed_at?: string }[];
  };
}

export interface ParsedSignedWebhook {
  signingRequestId: string;
  dealId: string | null;
  signerName: string | null;
  signerEmail: string | null;
  completedAt: string | null;
}

/**
 * Parse le payload webhook `signing_request.completed`.
 * Extrait le deal_id depuis le `name` (pattern LCA-DEAL-{uuid|int}).
 */
export function parseSignedWebhook(
  body: FirmaSignedEvent,
): ParsedSignedWebhook {
  const sr = body.data?.signing_request;
  const firstSigner = body.data?.recipients?.[0];
  const dealId = sr?.name?.match(/LCA-DEAL-([a-zA-Z0-9-]+)/)?.[1] ?? null;

  return {
    signingRequestId: sr?.id ?? "",
    dealId,
    signerName: firstSigner?.name ?? null,
    signerEmail: firstSigner?.email ?? null,
    completedAt: sr?.completed_at ?? null,
  };
}

/** Construit un name traçable pour le devis. */
export function buildDevisName(
  invoiceNumber: string,
  companyName: string,
  dealId: string,
): string {
  return `Devis ${invoiceNumber} - ${companyName} (LCA-DEAL-${dealId})`;
}
