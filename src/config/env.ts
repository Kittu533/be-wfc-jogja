export const env = {
  port: Number(process.env.PORT ?? 4000),
  adminToken: process.env.ADMIN_TOKEN ?? "dev-admin-token",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "place-images",
};
