-- Run this in Supabase SQL Editor after the Prisma migration has created streamer_telemetry.
--
-- 1) Enable Realtime: In Supabase Dashboard go to Database > Replication,
--    find the supabase_realtime publication and add the streamer_telemetry table.
--
-- 2) RLS policies (run below):

ALTER TABLE streamer_telemetry ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anon) to read — required for viewers to subscribe via Realtime
CREATE POLICY "streamer_telemetry_select_all"
ON streamer_telemetry FOR SELECT
USING (true);

-- Allow only service role to insert/update (our API uses service role to upsert)
CREATE POLICY "streamer_telemetry_service_role_all"
ON streamer_telemetry FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
