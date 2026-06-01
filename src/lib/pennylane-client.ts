/**
 * Pennylane API v2 client — port ADV intra-CRM (Phase 2).
 *
 * Remplace les appels n8n WF-002b/WF-005 par de la logique TS directe.
 * Spec de référence : closing-academy/.claude/rules/pennylane-api-v2.md
 *
 * Conventions v2 critiques :
 * - IDs internes int64 uniquement (plus de source_id)
 * - Floats as strings ("15000.00") sur raw_currency_unit_price
 * - Payloads root-level (pas de wrapper { quote: {...} })
 * - POST /customers = 404 → toujours endpoint typé (/company_customers, /individual_customers)
 * - Filter = JSON array encodé en query string
 *
 * Auth : Bearer token (PENNYLANE_API_TOKEN).
 */

const BASE_URL = "https://app.pennylane.com/api/external/v2";
const DEFAULT_TIMEOUT_MS = 15_000;

// Retry config pour send_by_email (PDF gen async → 409 pendant 1-5 min)
const SEND_EMAIL_RETRY_MAX = 5;
const SEND_EMAIL_RETRY_DELAY_MS = 10_000;

export type VatRate = "FR_200" | "FR_100" | "FR_055" | "exempt";

export class PennylaneError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "PennylaneError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PennylaneCustomer {
  id: number;
  name?: string;
  external_reference?: string;
  emails?: string[];
  reg_no?: string;
  customer_type?: string;
}

export interface BillingAddress {
  address: string;
  postal_code: string;
  city: string;
  country_alpha2: string;
}

export interface CreateCompanyCustomerInput {
  name: string;
  emails?: string[];
  phone?: string;
  recipient?: string;
  externalReference: string;
  billingLanguage?: string;
  billingAddress?: BillingAddress;
  regNo?: string;
  vatNumber?: string;
}

export interface QuoteLine {
  productId?: number;
  label: string;
  quantity: number;
  unit?: string;
  /** Float as string, ex. "15000.00" */
  rawCurrencyUnitPrice: string;
  vatRate: VatRate;
  description?: string;
}

export interface CreateQuoteInput {
  /** ISO date YYYY-MM-DD (champ v2 = `date`, ex-`issued_at`) */
  date: string;
  /** ISO date YYYY-MM-DD (champ v2 = `deadline`, ex-`expires_at`) */
  deadline: string;
  customerId: number;
  externalReference: string;
  pdfInvoiceSubject?: string;
  pdfDescription?: string;
  specialMention?: string;
  invoiceLines: QuoteLine[];
  currency?: string;
  language?: string;
}

export interface PennylaneQuote {
  id: number;
  invoice_number?: string;
  public_file_url?: string;
  currency_amount?: string;
  external_reference?: string;
  customer?: { id: number };
}

export interface CreateInvoiceInput {
  date: string;
  deadline: string;
  customerId: number;
  externalReference: string;
  pdfInvoiceSubject?: string;
  pdfDescription?: string;
  specialMention?: string;
  invoiceLines: QuoteLine[];
  currency?: string;
  language?: string;
  draft?: boolean;
}

export interface PennylaneInvoice {
  id: number;
  invoice_number?: string;
  status?: string;
  draft?: boolean;
  paid?: boolean;
  date?: string;
  public_file_url?: string;
  currency_amount?: string;
  currency_amount_before_tax?: string;
  currency_tax?: string;
  external_reference?: string;
  customer?: { id: number };
}

export interface PennylaneProduct {
  id: number;
  label?: string;
  reference?: string;
  external_reference?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  has_more: boolean;
  next_cursor: string | null;
}

interface FilterClause {
  field: string;
  operator:
    | "eq"
    | "not_eq"
    | "lt"
    | "gt"
    | "lteq"
    | "gteq"
    | "in"
    | "not_in"
    | "start_with";
  value: string | number | (string | number)[];
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

function getToken(): string {
  const token = process.env.PENNYLANE_API_TOKEN;
  if (!token) {
    throw new PennylaneError(
      0,
      "(config)",
      "PENNYLANE_API_TOKEN env var manquante. Configurer dans .env.local.",
    );
  }
  return token;
}

function buildFilterQuery(clauses: FilterClause[]): string {
  return `filter=${encodeURIComponent(JSON.stringify(clauses))}`;
}

async function pennylaneFetch<T>(
  endpoint: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
        ...fetchInit.headers,
      },
    });

    // 204 No Content (send_by_email succès)
    if (res.status === 204) return null as T;

    const text = await res.text();
    if (!res.ok) {
      throw new PennylaneError(
        res.status,
        endpoint,
        `Pennylane ${res.status} sur ${endpoint}: ${text || "no body"}`,
        text,
      );
    }
    return (text ? JSON.parse(text) : null) as T;
  } catch (e) {
    if (e instanceof PennylaneError) throw e;
    const isAbort = e instanceof Error && e.name === "AbortError";
    throw new PennylaneError(
      0,
      endpoint,
      isAbort
        ? `Pennylane timeout après ${timeoutMs}ms sur ${endpoint}`
        : `Pennylane fetch failed sur ${endpoint}: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/**
 * Lookup customer par external_reference (lecture unifiée /customers).
 * Retourne le 1er match ou null.
 */
export async function lookupCustomerByExternalRef(
  externalRef: string,
): Promise<PennylaneCustomer | null> {
  const query = buildFilterQuery([
    { field: "external_reference", operator: "eq", value: externalRef },
  ]);
  const res = await pennylaneFetch<PaginatedResponse<PennylaneCustomer>>(
    `/customers?${query}`,
    { method: "GET" },
  );
  return res.items[0] ?? null;
}

/**
 * Crée un client B2B via /company_customers.
 * ⚠️ NE PAS inclure customer_type (→ 400). Utiliser billing_language + country_alpha2.
 */
export async function createCompanyCustomer(
  input: CreateCompanyCustomerInput,
): Promise<PennylaneCustomer> {
  const body: Record<string, unknown> = {
    name: input.name,
    external_reference: input.externalReference,
    billing_language: input.billingLanguage ?? "fr_FR",
  };
  if (input.emails?.length) body.emails = input.emails;
  if (input.phone) body.phone = input.phone;
  if (input.recipient) body.recipient = input.recipient;
  if (input.billingAddress) body.billing_address = input.billingAddress;
  if (input.regNo) body.reg_no = input.regNo;
  if (input.vatNumber) body.vat_number = input.vatNumber;

  return pennylaneFetch<PennylaneCustomer>("/company_customers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Idempotent : lookup par external_reference puis create si absent.
 * external_reference = "LCA-COMPANY-{supabase_company_id}".
 */
export async function findOrCreateCompanyCustomer(
  input: CreateCompanyCustomerInput,
): Promise<PennylaneCustomer> {
  const existing = await lookupCustomerByExternalRef(input.externalReference);
  if (existing) return existing;
  try {
    return await createCompanyCustomer(input);
  } catch (e) {
    // 422 "External reference has already been taken" → race, re-lookup
    if (e instanceof PennylaneError && e.status === 422) {
      const retry = await lookupCustomerByExternalRef(input.externalReference);
      if (retry) return retry;
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

function serializeLine(line: QuoteLine): Record<string, unknown> {
  const out: Record<string, unknown> = {
    label: line.label,
    quantity: line.quantity,
    raw_currency_unit_price: line.rawCurrencyUnitPrice,
    vat_rate: line.vatRate,
  };
  if (line.productId !== undefined) out.product_id = line.productId;
  if (line.unit) out.unit = line.unit;
  if (line.description) out.description = line.description;
  return out;
}

/**
 * POST /v2/quotes. Body root-level. Retourne invoice_number + public_file_url.
 * external_reference = "LCA-DEAL-{deal_id}".
 */
export async function createQuote(
  input: CreateQuoteInput,
): Promise<PennylaneQuote> {
  const body: Record<string, unknown> = {
    date: input.date,
    deadline: input.deadline,
    customer_id: input.customerId,
    external_reference: input.externalReference,
    currency: input.currency ?? "EUR",
    language: input.language ?? "fr_FR",
    invoice_lines: input.invoiceLines.map(serializeLine),
  };
  if (input.pdfInvoiceSubject) body.pdf_invoice_subject = input.pdfInvoiceSubject;
  if (input.pdfDescription) body.pdf_description = input.pdfDescription;
  if (input.specialMention) body.special_mention = input.specialMention;

  return pennylaneFetch<PennylaneQuote>("/quotes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Récupère un quote existant via customer_id (le seul filtre autorisé sur /quotes
 * avec id/status) puis match sur external_reference côté code. Utilisé pour
 * récupérer le devis après un POST 422 "External reference has already been taken".
 */
export async function findQuoteByCustomerAndRef(
  customerId: number,
  externalRef: string,
): Promise<PennylaneQuote | null> {
  const query = buildFilterQuery([
    { field: "customer_id", operator: "eq", value: customerId },
  ]);
  const res = await pennylaneFetch<PaginatedResponse<PennylaneQuote>>(
    `/quotes?${query}&limit=100`,
    { method: "GET" },
  );
  return res.items.find((q) => q.external_reference === externalRef) ?? null;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/** POST /v2/customer_invoices/create_from_quote. */
export async function createInvoiceFromQuote(
  quoteId: number,
  externalReference: string,
  draft = false,
): Promise<PennylaneInvoice> {
  return pennylaneFetch<PennylaneInvoice>(
    "/customer_invoices/create_from_quote",
    {
      method: "POST",
      body: JSON.stringify({
        quote_id: quoteId,
        draft,
        external_reference: externalReference,
      }),
    },
  );
}

/**
 * POST /v2/customer_invoices — création directe (WF-005).
 * external_reference = "LCA-BILLING-{billing_month_id}".
 */
export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<PennylaneInvoice> {
  const body: Record<string, unknown> = {
    date: input.date,
    deadline: input.deadline,
    customer_id: input.customerId,
    external_reference: input.externalReference,
    currency: input.currency ?? "EUR",
    language: input.language ?? "fr_FR",
    draft: input.draft ?? false,
    invoice_lines: input.invoiceLines.map(serializeLine),
  };
  if (input.pdfInvoiceSubject) body.pdf_invoice_subject = input.pdfInvoiceSubject;
  if (input.pdfDescription) body.pdf_description = input.pdfDescription;
  if (input.specialMention) body.special_mention = input.specialMention;

  return pennylaneFetch<PennylaneInvoice>("/customer_invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Récupère une invoice existante via customer_id puis match external_reference
 * côté code. Utilisé après un POST 422 "External reference has already been taken".
 */
export async function findInvoiceByCustomerAndRef(
  customerId: number,
  externalRef: string,
): Promise<PennylaneInvoice | null> {
  const query = buildFilterQuery([
    { field: "customer_id", operator: "eq", value: customerId },
  ]);
  const res = await pennylaneFetch<PaginatedResponse<PennylaneInvoice>>(
    `/customer_invoices?${query}&limit=100`,
    { method: "GET" },
  );
  return res.items.find((i) => i.external_reference === externalRef) ?? null;
}

/** GET /v2/customer_invoices/{id} — récupère une invoice (dont public_file_url du PDF). */
export async function getInvoice(invoiceId: number): Promise<PennylaneInvoice> {
  return pennylaneFetch<PennylaneInvoice>(`/customer_invoices/${invoiceId}`, {
    method: "GET",
  });
}

/**
 * DELETE /v2/customer_invoices/{id} — supprime un DRAFT (draft only, cf rule §14).
 * Sur une invoice finalisée → 422 "only applicable for draft invoices".
 */
export async function deleteInvoice(invoiceId: number): Promise<void> {
  await pennylaneFetch<null>(`/customer_invoices/${invoiceId}`, { method: "DELETE" });
}

/**
 * Finalise un draft : PUT /v2/customer_invoices/{id} draft:false.
 * ⚠️ Transition draft→finalized à confirmer en live-test (cf plan, fallback
 * delete+recreate si le PUT n'est pas supporté).
 */
export async function finalizeInvoice(invoiceId: number): Promise<PennylaneInvoice> {
  return pennylaneFetch<PennylaneInvoice>(`/customer_invoices/${invoiceId}`, {
    method: "PUT",
    body: JSON.stringify({ draft: false }),
  });
}

/**
 * POST /v2/customer_invoices/{id}/send_by_email.
 * 204 = succès. 409 = PDF pas encore généré → retry.
 *
 * `maxAttempts` : 5 par défaut (cron T8, le PDF invoice prend 1-5 min).
 * Pour un endpoint synchrone Vercel Hobby (timeout 10s), passer `maxAttempts: 1`
 * et catcher le 409 — le retry est délégué au cron.
 */
export async function sendInvoiceByEmail(
  invoiceId: number,
  recipients: string[],
  opts: { maxAttempts?: number; delayMs?: number } = {},
): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? SEND_EMAIL_RETRY_MAX;
  const delayMs = opts.delayMs ?? SEND_EMAIL_RETRY_DELAY_MS;
  const endpoint = `/customer_invoices/${invoiceId}/send_by_email`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pennylaneFetch<null>(endpoint, {
        method: "POST",
        body: JSON.stringify({ recipients }),
      });
      return;
    } catch (e) {
      const is409 = e instanceof PennylaneError && e.status === 409;
      if (is409 && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
}

/**
 * Polling invoices émises récemment (cron paid sync).
 * Filtre sur `date` (updated_at non garanti). Caller filtre paid && amount>0.
 */
export async function pollRecentInvoices(
  sinceDate: string,
): Promise<PennylaneInvoice[]> {
  const query = buildFilterQuery([
    { field: "date", operator: "gteq", value: sinceDate },
  ]);
  const items: PennylaneInvoice[] = [];
  let cursor: string | null = null;
  do {
    const url: string = cursor
      ? `/customer_invoices?${query}&cursor=${cursor}&limit=100`
      : `/customer_invoices?${query}&limit=100`;
    const res: PaginatedResponse<PennylaneInvoice> = await pennylaneFetch<
      PaginatedResponse<PennylaneInvoice>
    >(url, { method: "GET" });
    items.push(...res.items);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return items;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Télécharge un PDF (public_file_url) et le retourne en base64 (pour Firma). */
export async function downloadPdfAsBase64(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new PennylaneError(
        res.status,
        url,
        `Download PDF échoué (${res.status})`,
      );
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch (e) {
    if (e instanceof PennylaneError) throw e;
    throw new PennylaneError(
      0,
      url,
      `Download PDF failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Liste le catalogue produits (pour résoudre les product_id par reference). */
export async function listProducts(limit = 100): Promise<PennylaneProduct[]> {
  const res = await pennylaneFetch<PaginatedResponse<PennylaneProduct>>(
    `/products?limit=${limit}`,
    { method: "GET" },
  );
  return res.items;
}

/** Auth ping (GET /v2/me) — valide le token avant E2E. */
export async function ping(): Promise<unknown> {
  return pennylaneFetch<unknown>("/me", { method: "GET" });
}
