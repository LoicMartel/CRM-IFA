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

export function computeCotation(params: CotationParams): CotationResults {
  const {
    nbLearners, months, nbRiseUp, tjmLca, baseCoeff, travelCoeff, prepCoeff,
    costPerDayPresentiel, riseUpCostPerLicense, vtDurationHours, presentielHoursPerDay,
  } = params;

  const totalPresentielDays = Object.values(months).reduce((s, m) => s + (m.presentiel || 0), 0);
  const totalVtSessions = Object.values(months).reduce((s, m) => s + (m.vt || 0), 0);

  const presentielHours = totalPresentielDays * presentielHoursPerDay;
  const vtHours = totalVtSessions * vtDurationHours;
  const formationHours = presentielHours + vtHours;

  const totalDaysEquivalent = totalPresentielDays + (vtHours / (presentielHoursPerDay || 8));
  const prepHours = formationHours * prepCoeff;
  const travelHours = presentielHours * travelCoeff;
  const interventionHours = formationHours + prepHours;
  const mobilisationHours = interventionHours + travelHours;

  const costPresentielLca = tjmLca * baseCoeff * totalPresentielDays;
  const costVtLca = tjmLca * baseCoeff * (vtHours / (presentielHoursPerDay || 8));
  const costPrep = tjmLca * prepCoeff * totalDaysEquivalent;
  const costTravel = tjmLca * travelCoeff * totalPresentielDays;
  const costPresentielClient = nbLearners * totalPresentielDays * costPerDayPresentiel;
  const costRiseUp = nbRiseUp * riseUpCostPerLicense;

  const totalHt = costPresentielLca + costVtLca + costPrep + costTravel + costPresentielClient + costRiseUp;

  const hourlyRateFormation = formationHours > 0 ? totalHt / formationHours : 0;
  const hourlyRatePerLearner = formationHours > 0 && nbLearners > 0
    ? totalHt / (formationHours * nbLearners) : 0;

  return {
    totalPresentielDays, totalVtSessions,
    presentielHours, vtHours, formationHours, prepHours, travelHours,
    interventionHours, mobilisationHours,
    costPresentielLca, costVtLca, costPrep, costTravel,
    costPresentielClient, costRiseUp,
    totalHt, hourlyRateFormation, hourlyRatePerLearner,
  };
}
