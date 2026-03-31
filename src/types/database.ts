// Types principaux du CRM Closing Académie

export type TeamMemberRole = "admin" | "sales" | "trainer" | "account_manager" | "finance";
export type LeadStepStatus = "pending" | "done" | "skipped";
export type LeadStatus = "nouveau" | "en_cours" | "r_plus_booked" | "gagné" | "perdu";
export type OpportunityStage = "opportunité" | "pipe" | "gagné" | "perdu";
export type LearnerStatus = "ancien" | "actuel" | "futur";
export type DeliveryMode = "présentiel" | "distanciel";
export type FundingType = "UP FRONT" | "OPCO" | "CPF" | "autre";
export type ActivityType = "appel" | "email" | "réunion" | "note" | "tâche" | "relance";
export type Department = "ADMIN" | "MARKETING" | "PÉDAGOGIE" | "VENTE" | "RH";

// New CRM types
export type MeetingType = "R0" | "R1" | "R2" | "R3";
export type MeetingStatus = "booked" | "done" | "no_show" | "cancelled";
export type MeetingMode = "visio" | "phone" | "in_person";
export type DealStage = "opportunities" | "quote_to_send" | "quote_sent" | "opco_deposit" | "quote_signed" | "closed_won" | "closed_lost";
export type LifecycleStage = "subscriber" | "lead" | "lead_marketing" | "mql" | "sql" | "opportunity" | "customer" | "evangelist";
export type ContactLeadStatus = "lead" | "contacted" | "booked" | "rdv_done" | "signed";
export type ContactType = "inbound" | "outbound";
export type CompanyLifecycle = "lead" | "prospect" | "customer" | "partner" | "former_customer";

export interface TeamMember {
  id: string;
  auth_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: TeamMemberRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  company_type_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string;
  website: string | null;
  notes: string | null;
  industry: string | null;
  employee_count: string | null;
  annual_revenue: string | null;
  lifecycle_stage: CompanyLifecycle;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  company_id: string | null;
  is_client: boolean;
  notes: string | null;
  lifecycle_stage: LifecycleStage;
  lead_status: ContactLeadStatus | null;
  last_contacted_at: string | null;
  contact_type: ContactType | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  company_type_id: string | null;
  sales_id: string | null;
  source_id: string | null;
  month_year: string | null;
  r1_status: LeadStepStatus;
  r2_status: LeadStepStatus;
  r3_status: LeadStepStatus;
  r3_2_status: LeadStepStatus;
  follow_up: string | null;
  status: LeadStatus;
  synced_to_crm: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  assigned_to: string | null;
  meeting_type: MeetingType;
  status: MeetingStatus;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_mode: MeetingMode;
  notes: string | null;
  outcome: string | null;
  next_step: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  name: string;
  contact_id: string | null;
  company_id: string | null;
  owner_id: string | null;
  source_id: string | null;
  stage: DealStage;
  amount: number | null;
  training_days: number | null;
  probability: number;
  expected_close_date: string | null;
  close_date: string | null;
  lost_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  name: string;
  contact_id: string | null;
  company_id: string | null;
  sales_id: string | null;
  amount: number | null;
  training_days: number | null;
  stage: OpportunityStage;
  is_planned: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  client_name: string;
  company_id: string | null;
  contact_id: string | null;
  account_manager_id: string | null;
  source_id: string | null;
  order_date: string;
  amount: number;
  training_days: number | null;
  is_invoiced: boolean;
  invoice_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Learner {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  company_id: string | null;
  status: LearnerStatus;
  program_id: string | null;
  training_type_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServicePlan {
  id: string;
  company_id: string;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  program_id: string | null;
  training_type_id: string | null;
  budget: number | null;
  budget_remaining: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  week_number: string | null;
  session_date: string;
  company_id: string | null;
  theme_id: string | null;
  delivery_mode: DeliveryMode;
  is_billable: boolean;
  attendee_names: string | null;
  session_label: string | null;
  hours_planned: number | null;
  hours_delivered: number | null;
  learners_planned: number | null;
  learners_delivered: number | null;
  hourly_rate: number;
  non_billable_amount: number;
  billable_amount: number;
  trainer_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  company_id: string | null;
  order_id: string | null;
  client_name: string;
  funding_type: FundingType | null;
  month: string;
  amount: number;
  is_paid: boolean;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyFinance {
  id: string;
  month: string;
  orders_target: number | null;
  orders_actual: number;
  delivered_amount: number;
  billable_delivery: number;
  billable_adv: number;
  invoiced_amount: number;
  collected_amount: number;
  client_receivables: number;
  disbursed_amount: number;
  loan_repayment: number;
  charges_amount: number;
  cash_flow: number;
  treasury: number;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  category_id: string | null;
  tool_name: string | null;
  department: Department | null;
  month: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesTarget {
  id: string;
  month: string;
  target_amount: number;
  actual_amount: number;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  team_member_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  lead_id: string | null;
  opportunity_id: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

// Référentiels
export interface CompanyType {
  id: string;
  name: string;
  created_at: string;
}

export interface LeadSource {
  id: string;
  name: string;
  created_at: string;
}

export interface TrainingProgram {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface TrainingType {
  id: string;
  name: string;
  created_at: string;
}

export interface SessionTheme {
  id: string;
  name: string;
  is_billable: boolean;
  delivery_mode: DeliveryMode;
  default_hours: number | null;
  default_rate: number;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parent_category: string | null;
  created_at: string;
}

// Labels & Colors helpers
export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  R0: "R0 — Qualification",
  R1: "R1 — Découverte",
  R2: "R2 — Solution",
  R3: "R3 — Négociation",
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  booked: "Planifié",
  done: "Effectué",
  no_show: "No show",
  cancelled: "Annulé",
};

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  opportunities: "Opportunités",
  quote_to_send: "Devis à envoyer",
  quote_sent: "Devis envoyé",
  opco_deposit: "Dépôt OPCO",
  quote_signed: "Devis signé",
  closed_won: "Gagné",
  closed_lost: "Perdu",
};

export const DEAL_STAGE_PROBABILITY: Record<DealStage, number> = {
  opportunities: 20,
  quote_to_send: 40,
  quote_sent: 60,
  opco_deposit: 75,
  quote_signed: 85,
  closed_won: 100,
  closed_lost: 0,
};

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  subscriber: "Abonné",
  lead: "Lead",
  lead_marketing: "Lead Marketing",
  mql: "MQL",
  sql: "SQL",
  opportunity: "Opportunité",
  customer: "Client",
  evangelist: "Ambassadeur",
};

export const COMPANY_LIFECYCLE_LABELS: Record<CompanyLifecycle, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Client",
  partner: "Partenaire",
  former_customer: "Ancien client",
};
