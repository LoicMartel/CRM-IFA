export interface CotationParams {
  nbLearners: number;
  months: Record<string, { presentiel: number; vt: number }>;
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
}

export const MONTH_KEYS = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"] as const;
export const MONTH_LABELS: Record<string, string> = {
  janv: "Janv", fevr: "Févr", mars: "Mars", avr: "Avr", mai: "Mai", juin: "Juin",
  juil: "Juil", aout: "Août", sept: "Sept", oct: "Oct", nov: "Nov", dec: "Déc",
};

export function emptyMonths(): Record<string, { presentiel: number; vt: number }> {
  const m: Record<string, { presentiel: number; vt: number }> = {};
  for (const k of MONTH_KEYS) m[k] = { presentiel: 0, vt: 0 };
  return m;
}

// VT day-equivalent uses 7h/day (each VT = 1/7 of a day, matching the spreadsheet formula =1/7)
const VT_DAY_DENOMINATOR = 7;

export function computeCotation(params: CotationParams): CotationResults {
  const {
    nbLearners, months, nbRiseUp, tjmLca, baseCoeff, travelCoeff, prepCoeff,
    costPerDayPresentiel, riseUpCostPerLicense, vtDurationHours, presentielHoursPerDay,
    costFournituresPerLearner,
  } = params;

  const totalPresentielDays = Object.values(months).reduce((s, m) => s + (m.presentiel || 0), 0);
  const totalVtSessions = Object.values(months).reduce((s, m) => s + (m.vt || 0), 0);

  const presentielHours = totalPresentielDays * presentielHoursPerDay;
  const vtHours = totalVtSessions * vtDurationHours;
  const formationHours = presentielHours + vtHours;

  // VT day-equivalent: each VT session = vtDurationHours / 7 of a day
  const vtDaysEquivalent = (vtHours / VT_DAY_DENOMINATOR);
  const totalDaysEquivalent = totalPresentielDays + vtDaysEquivalent;

  const prepHours = formationHours * prepCoeff;
  const travelHours = presentielHours * travelCoeff;
  const interventionHours = formationHours + prepHours;
  const mobilisationHours = interventionHours + travelHours;

  // LCA costs (pédagogie)
  const costPresentielLca = tjmLca * baseCoeff * totalPresentielDays;
  const costVtLca = tjmLca * baseCoeff * vtDaysEquivalent;
  const costPrep = tjmLca * prepCoeff * totalDaysEquivalent;
  const costTravel = tjmLca * travelCoeff * totalPresentielDays;

  // Client costs (frais + fournitures)
  // Frais présentiel = coût/jour × nb jours (NOT per learner)
  const costPresentielClient = totalPresentielDays * costPerDayPresentiel;
  // Fournitures = coût/apprenant × nb apprenants
  const costFournitures = nbLearners * costFournituresPerLearner;
  const costRiseUp = nbRiseUp * riseUpCostPerLicense;

  const totalHt = costPresentielLca + costVtLca + costPrep + costTravel + costPresentielClient + costFournitures + costRiseUp;

  const hourlyRateFormation = formationHours > 0 ? totalHt / formationHours : 0;
  const hourlyRatePerLearner = formationHours > 0 && nbLearners > 0
    ? totalHt / (formationHours * nbLearners) : 0;

  return {
    totalPresentielDays, totalVtSessions,
    presentielHours, vtHours, formationHours, prepHours, travelHours,
    interventionHours, mobilisationHours,
    costPresentielLca, costVtLca, costPrep, costTravel,
    costPresentielClient, costFournitures, costRiseUp,
    totalHt, hourlyRateFormation, hourlyRatePerLearner,
  };
}
