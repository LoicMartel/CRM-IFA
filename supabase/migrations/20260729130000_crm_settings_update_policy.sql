-- Allow authenticated users to update CRM settings
CREATE POLICY "Authenticated users can update settings"
  ON public.crm_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
