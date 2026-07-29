import * as XLSX from "xlsx";

// ===== Types =====

export interface VisioRow {
  nom: string;
  entreprise: string;
  tel: string;
  email: string;
  adresse: string;
  sessions: number;
  dateNaissance: string;
}

export interface ImportRow extends VisioRow {
  firstName: string;
  lastName: string;
  action: "create" | "update" | "skip";
  existingId: string | null;
  companyId: string | null;
  companyName: string;
  companyMatchType: "exact" | "partial" | "domain" | "none";
}

// ===== Parsing =====

export function parseVisioformationExport(buffer: ArrayBuffer): VisioRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return raw.map((row) => ({
    nom: String(row["Nom"] ?? "").trim(),
    entreprise: String(row["Entreprise"] ?? "").trim(),
    tel: String(row["Tel"] ?? row["Téléphone"] ?? "").trim(),
    email: String(row["Email"] ?? "").trim().toLowerCase(),
    adresse: String(row["Adresse"] ?? "").trim(),
    sessions: Number(row["Sessions"] ?? 0),
    dateNaissance: String(row["Date de naissance"] ?? "").trim(),
  })).filter((r) => r.nom && r.email);
}

// ===== Name splitting =====

export function splitName(nom: string): { firstName: string; lastName: string } {
  const parts = nom.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };

  // Check if first part is all uppercase (NOM Prénom format, e.g. "VALLEIX Abel")
  const firstIsUpper = parts[0] === parts[0].toUpperCase() && parts[0].length > 1;
  const lastIsUpper = parts[parts.length - 1] === parts[parts.length - 1].toUpperCase() && parts[parts.length - 1].length > 1;

  if (firstIsUpper && !lastIsUpper) {
    // Inverted: NOM Prénom — find where uppercase ends
    let splitIdx = 1;
    for (let i = 1; i < parts.length; i++) {
      if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) {
        splitIdx = i + 1;
      } else {
        break;
      }
    }
    return {
      firstName: parts.slice(splitIdx).join(" "),
      lastName: parts.slice(0, splitIdx).join(" "),
    };
  }

  if (lastIsUpper) {
    // Standard: Prénom NOM — find where uppercase starts from end
    let splitIdx = parts.length - 1;
    for (let i = parts.length - 1; i >= 1; i--) {
      if (parts[i] === parts[i].toUpperCase() && parts[i].length > 1) {
        splitIdx = i;
      } else {
        break;
      }
    }
    return {
      firstName: parts.slice(0, splitIdx).join(" "),
      lastName: parts.slice(splitIdx).join(" "),
    };
  }

  // No uppercase pattern — assume first word = first name, rest = last name
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

// ===== Email domain extraction =====

export function extractEmailDomain(email: string): string {
  const parts = email.split("@");
  if (parts.length < 2) return "";
  return parts[1].toLowerCase();
}

export function extractDomainName(domain: string): string {
  // "leyton.com" -> "leyton", "ifagroupe.com" -> "ifagroupe"
  const parts = domain.split(".");
  if (parts.length < 2) return domain;
  return parts[0];
}

// ===== Company matching =====

interface CompanyRef {
  id: string;
  name: string;
}

export function matchCompany(
  entreprise: string,
  email: string,
  companies: CompanyRef[]
): { companyId: string | null; companyName: string; matchType: "exact" | "partial" | "domain" | "none" } {
  const entNorm = entreprise.toLowerCase().trim();

  // Priority 1: exact match on Entreprise column
  if (entNorm) {
    const exact = companies.find((c) => c.name.toLowerCase().trim() === entNorm);
    if (exact) return { companyId: exact.id, companyName: exact.name, matchType: "exact" };

    // Priority 2: partial match
    const partial = companies.find(
      (c) => c.name.toLowerCase().includes(entNorm) || entNorm.includes(c.name.toLowerCase())
    );
    if (partial) return { companyId: partial.id, companyName: partial.name, matchType: "partial" };
  }

  // Priority 3: email domain match
  if (email) {
    const domain = extractEmailDomain(email);
    const domainName = extractDomainName(domain);
    if (domainName && domainName.length > 2) {
      // Skip generic domains
      const generic = ["gmail", "hotmail", "yahoo", "outlook", "live", "icloud", "orange", "free", "sfr", "laposte", "wanadoo"];
      if (!generic.includes(domainName)) {
        const domainMatch = companies.find((c) =>
          c.name.toLowerCase().includes(domainName) || domainName.includes(c.name.toLowerCase().replace(/\s+/g, ""))
        );
        if (domainMatch) return { companyId: domainMatch.id, companyName: domainMatch.name, matchType: "domain" };
      }
    }
  }

  return { companyId: null, companyName: entreprise || "", matchType: "none" };
}

// ===== Build import rows with matching =====

export function buildImportRows(
  visioRows: VisioRow[],
  existingLearners: { id: string; email: string | null }[],
  companies: CompanyRef[]
): ImportRow[] {
  const emailToLearner = new Map<string, string>();
  existingLearners.forEach((l) => {
    if (l.email) emailToLearner.set(l.email.toLowerCase(), l.id);
  });

  return visioRows.map((row) => {
    const { firstName, lastName } = splitName(row.nom);
    const existingId = emailToLearner.get(row.email) ?? null;
    const { companyId, companyName, matchType } = matchCompany(row.entreprise, row.email, companies);

    return {
      ...row,
      firstName,
      lastName,
      action: existingId ? "update" : "create",
      existingId,
      companyId,
      companyName,
      companyMatchType: matchType,
    };
  });
}

// ===== Export CRM → Visioformation format =====

export function generateVisioformationImportXlsx(
  learners: { first_name: string; last_name: string; phone?: string | null; email?: string | null; position?: string | null }[]
): ArrayBuffer {
  const data = learners.map((l) => ({
    "Nom Complet": `${l.first_name} ${l.last_name}`.trim(),
    "Téléphone": l.phone || "",
    "Adresse": "",
    "Email": l.email || "",
    "Nom d'utilisateur": "",
    "Date de naissance (Format jj/mm/aaaa)": "",
    "ID Externe": "",
    "No. Sécurité Sociale": "",
    "Catégorie socio-professionnelle": "",
    "Nature du contrat de travail": "",
    "Salaire Horaire Brut": "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Apprenants");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
