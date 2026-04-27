import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3001"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 chars"),

  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().default("noreply@band.stream"),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_PUBLIC_KEY: z.string().startsWith("pk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_CONNECT_CLIENT_ID: z.string().startsWith("ca_").optional(),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),

  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  META_OAUTH_REDIRECT_URI: z.string().url().optional(),

  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be 32 bytes base64"),

  COMMISSION_RATE_PRO: z.coerce.number().min(0).max(1).default(0.03),
  COMMISSION_RATE_LABEL: z.coerce.number().min(0).max(1).default(0),
  COMMISSION_FLOOR_CENTS_PRO: z.coerce.number().int().min(0).default(30),
  COMMISSION_FLOOR_CENTS_LABEL: z.coerce.number().int().min(0).default(0),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`[env] Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
