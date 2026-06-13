export const CHANNELS = ["linkedin", "email", "whatsapp", "instagram", "messenger", "sms", "web_form"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CATEGORIES = ["a", "b", "c"] as const; // a=useless, b=à répondre, c=prioritaire
export type Category = (typeof CATEGORIES)[number];

export const INTENTS = ["rdv", "devis", "question", "spam", "autre"] as const;
export type Intent = (typeof INTENTS)[number];

export const AGENT_STATUSES = ["active", "human", "escalated", "booked", "dormant"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const ESCALATION_REASONS = [
  "high_value", "explicit_human", "low_confidence", "keyword",
  "off_script", "negative", "existing_contact", "linkedin",
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export type SentBy = "lead" | "agent" | "human";

// Canaux où l'agent répond en full-auto (LinkedIn exclu = escalade only ; SMS = V1.1)
export const AGENT_CHANNELS: Channel[] = ["email", "whatsapp", "instagram", "messenger", "web_form"];
// Canaux où Rafi peut répondre depuis le CRM (LinkedIn lecture seule)
export const SAFE_REPLY_CHANNELS: Channel[] = ["email", "whatsapp", "instagram", "messenger"];

export const FOLLOWUP_DELAY_HOURS = 48;
export const MAX_AGENT_TURNS = 3;

export interface IncomingMessage {
  channel: Channel;
  direction: "inbound" | "outbound"; // outbound = message émis hors CRM (anti-collision)
  accountId: string | null;
  // email: thread_id · chat: chat_id · web_form: webform-<email>
  externalChatId: string | null;
  // email: provider_id (Gmail/provider msg id, also the reply_to target) · chat: message_id
  externalMessageId: string | null;
  senderName: string | null;
  senderHandle: string | null; // email / linkedin url / phone
  body: string;
  subject?: string | null;
}

export interface ConversationRow {
  id: string;
  contact_id: string | null;
  channel: Channel;
  account_id: string | null;
  external_chat_id: string | null;
  subject: string | null;
  category: Category | null;
  intent: Intent | null;
  agent_status: AgentStatus;
  escalation_reason: EscalationReason | null;
  agent_last_acted_at: string | null;
  agent_turn_count: number;
  unread: boolean;
  last_message_at: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  // Scoring copilote (chantier F P1) — nullable tant que la migration interest_score n'est pas appliquée.
  interest_score?: number | null;
  score_reason?: string | null;
  // Tri courrier (chantier C) — nullable, seul le chemin classify les écrit.
  triage_folder?: string | null;
  triage_action_required?: boolean | null;
  triage_assignee?: string | null;
  triage_assignee_source?: string | null;
  triage_folder_reason?: string | null;
  triage_folder_source?: string | null;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  sent_by: SentBy;
  sender_name: string | null;
  sender_handle: string | null;
  body: string;
  external_message_id: string | null;
  is_draft: boolean;
  status: "received" | "draft" | "validated" | "sent" | "failed";
  sent_at: string | null;
  created_at: string;
}
