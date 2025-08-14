# Monadgram: Supabase setup (one-time)

## 1) Create project
- Go to supabase.com → New Project
- Note your `Project URL` and `anon`/`service_role` keys

## 2) Run schema
- Open SQL Editor → run `supabase/schema.sql`
- This creates table `public.submissions` + RLS for public reads of approved items

## 3) Create Storage bucket
- In Storage: create bucket `monadgram` (public)
- No sub-buckets needed; we will store under `pending/` and `approved/`

## 4) Edge Functions
Create functions with the files in `supabase/functions/*`:
- upload-submission
- list-pending
- approve-submission
- delete-submission
- cleanup-pending (NEW - for storage optimization)

Each function requires environment variables:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- MONADGRAM_BUCKET=monadgram
- ADMIN_KEY (a long random secret; your `/admin` will send this in `x-admin-key`)

Deploy (CLI example):
```
supabase functions deploy upload-submission
supabase functions deploy list-pending
supabase functions deploy approve-submission
supabase functions deploy delete-submission
supabase functions deploy cleanup-pending
```

## 5) Frontend wiring (next step)
- Upload: POST to `upload-submission` with `{ dataUrl, fileName, twitter }`
- Admin list: GET `list-pending` with header `x-admin-key: <ADMIN_KEY>`
- Admin approve: POST `approve-submission` with `{ id }` + `x-admin-key`
- Admin delete: POST `delete-submission` with `{ id }` + `x-admin-key`
- Cleanup: POST `cleanup-pending` with `x-admin-key` (runs automatically)

## 6) Hosting
- Deploy static site to Vercel/Netlify. Add env vars for function URLs if you proxy through your domain.

## 7) Storage & Bandwidth Optimization (Free Tier)

### Client-side optimizations:
- ✅ **Image compression**: Images are compressed to max 800px width, 80% quality
- ✅ **File size limits**: 1MB max upload size enforced
- ✅ **Lazy loading**: Images load only when visible
- ✅ **Format optimization**: Converts to JPEG for better compression

### Server-side optimizations:
- ✅ **Automatic cleanup**: Pending submissions older than 30 days are auto-deleted
- ✅ **Size tracking**: Upload function reports original vs optimized sizes
- ✅ **Storage monitoring**: Use `scripts/monitor-storage.js` to track usage

### Manual cleanup:
```bash
# Run cleanup function manually
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-pending \
  -H "x-admin-key: YOUR_ADMIN_KEY"

# Monitor storage usage
node scripts/monitor-storage.js
```

### Free tier limits:
- **Storage**: 1 GB (monitor with script above)
- **Bandwidth**: 2 GB/month
- **Database**: 500 MB
- **Edge Functions**: 500,000 invocations/month

### Tips to stay within limits:
1. **Regular cleanup**: Set up cron job to run cleanup-pending daily
2. **Monitor usage**: Run storage monitor weekly
3. **Compress aggressively**: Consider reducing max width to 600px if needed
4. **Delete rejected**: Manually delete rejected submissions promptly
5. **Use CDN**: Consider Cloudflare for additional caching

That's it. All content changes happen via `/admin`; public site reads approved items live from Supabase.
