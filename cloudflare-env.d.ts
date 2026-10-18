declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    APP_SECRET?: string;
    APIFY_TOKEN?: string;
    GROQ_API_KEY?: string;
    GROQ_MODEL?: string;
    MODEL_PROVIDER?: string;
  }
}
