// Fill these with your Supabase details after deploying functions
window.MonadgramConfig = {
  SUPABASE_URL: "https://yeicfeuddxapcsfyjpvj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllaWNmZXVkZHhhcGNzZnlqcHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxOTM4MzcsImV4cCI6MjA3MDc2OTgzN30.TBQSWUt7ipXcfmm7irRM1opkDnah9fblaUtD_-wb28c",
  BUCKET: "monadgram",
  // Edge Function URLs (deployed via Supabase functions deploy ...)
  EDGE: {
    UPLOAD_URL: "https://yeicfeuddxapcsfyjpvj.supabase.co/functions/v1/upload-submission",
    LIST_PENDING_URL: "https://yeicfeuddxapcsfyjpvj.supabase.co/functions/v1/list-pending",
    APPROVE_URL: "https://yeicfeuddxapcsfyjpvj.supabase.co/functions/v1/approve-submission",
    DELETE_URL: "https://yeicfeuddxapcsfyjpvj.supabase.co/functions/v1/delete-submission",
    LIST_APPROVED_URL: "https://yeicfeuddxapcsfyjpvj.supabase.co/functions/v1/list-approved",
  },
  buildPublicUrl(storagePath) {
    const base = `${this.SUPABASE_URL}/storage/v1/object/public/${this.BUCKET}/`;
    return base + storagePath;
  },
};


