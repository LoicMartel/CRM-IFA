/**
 * Client Carbone Cloud (génération .docx -> PDF).
 * 2 étapes : POST /render/{templateId} -> renderId, puis GET /render/{renderId} -> PDF bytes.
 */

const BASE_URL = "https://api.carbone.io";

export class CarboneError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CarboneError";
  }
}

function getConfig(): { apiKey: string; templateId: string } {
  const apiKey = process.env.CARBONE_API_KEY;
  const templateId = process.env.CARBONE_CONVENTION_TEMPLATE_ID;
  if (!apiKey) throw new CarboneError("CARBONE_API_KEY manquant");
  if (!templateId) throw new CarboneError("CARBONE_CONVENTION_TEMPLATE_ID manquant");
  return { apiKey, templateId };
}

/** Rend le template convention avec `data` et retourne le PDF (Buffer). */
export async function renderConventionPdf(data: Record<string, unknown>): Promise<Buffer> {
  const { apiKey, templateId } = getConfig();
  const headers = { Authorization: `Bearer ${apiKey}`, "carbone-version": "4", "Content-Type": "application/json" };

  const renderRes = await fetch(`${BASE_URL}/render/${templateId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data, convertTo: "pdf" }),
  });
  if (!renderRes.ok) {
    throw new CarboneError(`Carbone render failed: ${await renderRes.text()}`, renderRes.status);
  }
  const json = (await renderRes.json()) as { success: boolean; data?: { renderId?: string }; error?: string };
  const renderId = json.data?.renderId;
  if (!json.success || !renderId) {
    throw new CarboneError(`Carbone render error: ${json.error ?? "no renderId"}`);
  }

  const pdfRes = await fetch(`${BASE_URL}/render/${renderId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "carbone-version": "4" },
  });
  if (!pdfRes.ok) {
    throw new CarboneError(`Carbone fetch PDF failed: ${pdfRes.status}`, pdfRes.status);
  }
  return Buffer.from(await pdfRes.arrayBuffer());
}
