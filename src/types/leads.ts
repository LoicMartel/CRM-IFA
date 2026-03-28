import type { LeadStepStatus, LeadStatus } from "./database";

export interface LeadWithRelations {
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
  // Joined fields
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  company_name?: string | null;
  sales_first_name?: string | null;
  sales_last_name?: string | null;
  source_name?: string | null;
  company_type_name?: string | null;
}

export interface SalesMember {
  id: string;
  first_name: string;
  last_name: string;
}

export interface CompanyTypeOption {
  id: string;
  name: string;
}

export interface LeadSourceOption {
  id: string;
  name: string;
}
