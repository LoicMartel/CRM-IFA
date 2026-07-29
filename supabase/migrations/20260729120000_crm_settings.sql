-- CRM settings: key-value store for global configuration
CREATE TABLE public.crm_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Enable RLS (read-only for authenticated users)
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON public.crm_settings FOR SELECT
  TO authenticated
  USING (true);

-- Seed the fiscal year mode (default sep-aug for IFA)
INSERT INTO public.crm_settings (key, value)
VALUES ('fiscal_year_mode', 'sep-aug');
