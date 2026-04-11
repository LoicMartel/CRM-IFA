export interface CotationRow {
  id: string;
  title: string;
  type: "presentiel" | "vt";
  months: Record<string, number>;
}

export interface CotationParams {
  nbLearners: number;
  rows: CotationRow[];
  nbRiseUp: number;
  tjmLca: number;
  baseCoeff: number;
  travelCoeff: number;
  prepCoeff: number;
  costPerDayPresentiel: number;
  riseUpCostPerLicense: number;
  vtDurationHours: number;
  presentielHoursPerDay: number;
  costFournituresPerLearner: number;
}

export interface CotationResults {
  totalPresentielDays: number;
  totalVtSessions: number;
  presentielHours: number;
  vtHours: number;
  formationHours: number;
  prepHours: number;
  travelHours: number;
  interventionHours: number;
  mobilisationHours: number;
  costPresentielLca: number;
  costVtLca: number;
  costPrep: number;
  costTravel: number;
  costPresentielClient: number;
  costFournitures: number;
  costRiseUp: number;
  totalHt: number;
  hourlyRateFormation: number;
  hourlyRatePerLearner: number;
  hourlyRateMobilisationLca: number;
  hourlyRateMobilisationLcaPerLearner: number;
}

export const MONTH_KEYS = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"] as const;
export const MONTH_LABELS: Record<string, string> = {
  janv: "Janv", fevr: "Févr", mars: "Mars", avr: "Avr", mai: "Mai", juin: "Juin",
  juil: "Juil", aout: "Août", sept: "Sept", oct: "Oct", nov: "Nov", dec: "Déc",
};

export function emptyRowMonths(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const k of MONTH_KEYS) m[k] = 0;
  return m;
}

export function createRow(type: "presentiel" | "vt" = "vt", title = ""): CotationRow {
  return { id: crypto.randomUUID(), title, type, months: emptyRowMonths() };
}

/** Sum all monthly values of a single row */
export function rowTotal(row: CotationRow): number {
  return Object.values(row.months).reduce((s, v) => s + (v || 0), 0);
}

// VT day-equivalent uses 7h/day (each VT = 1/7 of a day, matching the spreadsheet formula =1/7)
const VT_DAY_DENOMINATOR = 7;

export function computeCotation(params: CotationParams): CotationResults {
  const {
    nbLearners, rows, nbRiseUp, tjmLca, baseCoeff, travelCoeff, prepCoeff,
    costPerDayPresentiel, riseUpCostPerLicense, vtDurationHours, presentielHoursPerDay,
    costFournituresPerLearner,
  } = params;

  const totalPresentielDays = rows
    .filter(r => r.type === "presentiel")
    .reduce((s, r) => s + Object.values(r.months).reduce((a, v) => a + (v || 0), 0), 0);
  const totalVtSessions = rows
    .filter(r => r.type === "vt")
    .reduce((s, r) => s + Object.values(r.months).reduce((a, v) => a + (v || 0), 0), 0);

  const presentielHours = totalPresentielDays * presentielHoursPerDay;
  const vtHours = totalVtSessions * vtDurationHours;
  const formationHours = presentielHours + vtHours;

  const vtDaysEquivalent = vtHours / VT_DAY_DENOMINATOR;
  const totalDaysEquivalent = totalPresentielDays + vtDaysEquivalent;

  const prepHours = formationHours * prepCoeff;
  const travelHours = presentielHours * travelCoeff;
  const interventionHours = formationHours + prepHours;
  const mobilisationHours = interventionHours + travelHours;

  const costPresentielLca = tjmLca * baseCoeff * totalPresentielDays;
  const costVtLca = tjmLca * baseCoeff * vtDaysEquivalent;
  const costPrep = tjmLca * prepCoeff * totalDaysEquivalent;
  const costTravel = tjmLca * travelCoeff * totalPresentielDays;

  const costPresentielClient = totalPresentielDays * costPerDayPresentiel;
  const costFournitures = nbLearners * costFournituresPerLearner;
  const costRiseUp = nbRiseUp * riseUpCostPerLicense;

  const totalHt = costPresentielLca + costVtLca + costPrep + costTravel + costPresentielClient + costFournitures + costRiseUp;

  const hourlyRateFormation = formationHours > 0 ? totalHt / formationHours : 0;
  const hourlyRatePerLearner = formationHours > 0 && nbLearners > 0
    ? totalHt / (formationHours * nbLearners) : 0;

  const totalLcaPedagogie = costPresentielLca + costVtLca + costPrep + costTravel + costRiseUp;
  const hourlyRateMobilisationLca = mobilisationHours > 0 ? totalLcaPedagogie / mobilisationHours : 0;
  const hourlyRateMobilisationLcaPerLearner = mobilisationHours > 0 && nbLearners > 0
    ? totalLcaPedagogie / (mobilisationHours * nbLearners) : 0;

  return {
    totalPresentielDays, totalVtSessions,
    presentielHours, vtHours, formationHours, prepHours, travelHours,
    interventionHours, mobilisationHours,
    costPresentielLca, costVtLca, costPrep, costTravel,
    costPresentielClient, costFournitures, costRiseUp,
    totalHt, hourlyRateFormation, hourlyRatePerLearner,
    hourlyRateMobilisationLca, hourlyRateMobilisationLcaPerLearner,
  };
}
