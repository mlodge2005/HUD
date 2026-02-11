# Telemetry diagnostics checklist

Use this to verify viewers see streamer compass heading and map marker rotation matches.

## 1) Confirm DB column names

Run in **Supabase SQL Editor**:

```sql
select column_name from information_schema.columns where table_name='streamer_telemetry' order by ordinal_position;
```

Expected columns: `streamer_id`, `lat`, `lon`, `heading`, `accuracy`, `updated_at`.

Then:

```sql
select * from streamer_telemetry order by updated_at desc limit 5;
```

Confirm rows have the expected columns and types.

---

## 2) Confirm streamer is posting telemetry

On the **streamer device**, open DevTools → Console. You should see:

- `[telemetry] POST payload` with `{ lat, lon, accuracy, heading? }` (heading a number when available).
- POST `/api/streamer-telemetry` returns **200** in Network tab.

---

## 3) Confirm DB row updates

While streaming, re-run in Supabase:

```sql
select * from streamer_telemetry order by updated_at desc limit 5;
```

`heading` and `updated_at` should change at least every 1–2 seconds for the active streamer row.

---

## 4) Confirm viewer subscription fires

On a **viewer device**, open DevTools → Console. You should see:

- `[telemetry] realtime event` with the full Supabase Realtime payload when the streamer’s row changes.

---

## 5) Column name consistency

The app uses **snake_case** for the DB: `streamer_id` everywhere (API upsert keys, `select` columns, `.eq("streamer_id", ...)`, realtime filter `streamer_id=eq.${streamerId}`). If you see mismatches (e.g. `streamerId` in API or filters), normalize to `streamer_id` in:

- API upsert payload
- Supabase `select` / `eq` / realtime filter string

---

## 6) Fix marker rotation offset

If the map arrow is **off by 90°**:

- Try URL: `/hud?rotOffset=90` or `/hud?rotOffset=-90` (dev only).  
  Equivalent: `rotation = (heading + 90) % 360` (or `-90`).

If the arrow is **mirrored**:

- Try `/hud?rotInvert=1` and optionally `?rotOffset=90`.  
  Equivalent: `rotation = (360 - heading + 90) % 360`.

Pick the combo where North on the compass = arrow points up.
