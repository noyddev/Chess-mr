/**
 * Environment Variable Validation
 * Ensures all required environment variables are present in production
 */

export interface EnvValidation {
  valid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
}

const REQUIRED_VARS = [
  "DATABASE_URL",
] as const;

const OPTIONAL_VARS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_API_URL",
  "LICHESS_TOKEN",
  "NODE_ENV",
] as const;

const URL_VARS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_API_URL",
] as const;

/**
 * Validate URL format for environment variables that should be URLs
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate all environment variables
 */
export function validateEnv(): EnvValidation {
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value) {
      missing.push(varName);
    } else if (URL_VARS.includes(varName) && !isValidUrl(value)) {
      invalid.push(varName);
    }
  }

  // Check optional variables and log warnings
  for (const varName of OPTIONAL_VARS) {
    const value = process.env[varName];
    if (!value && varName !== "LICHESS_TOKEN") {
      warnings.push(`${varName} is not set`);
    } else if (URL_VARS.includes(varName) && value && !isValidUrl(value)) {
      invalid.push(varName);
    }
  }

  // Log validation results
  if (missing.length > 0) {
    console.error("[ENV_VALIDATION_ERROR] Missing required environment variables:", missing);
  }
  
  if (invalid.length > 0) {
    console.error("[ENV_VALIDATION_ERROR] Invalid environment variables:", invalid);
  }
  
  if (warnings.length > 0) {
    console.warn("[ENV_VALIDATION_WARNING] Optional environment variables not set:", warnings);
  }

  // Log current environment info (without sensitive values)
  console.log("[ENV_VALIDATION] Environment info:", {
    NODE_ENV: process.env.NODE_ENV || "not set",
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_FORMAT: process.env.DATABASE_URL 
      ? (isValidUrl(process.env.DATABASE_URL) ? "valid" : "invalid") 
      : "not set",
    HAS_LICHESS_TOKEN: !!process.env.LICHESS_TOKEN,
  });

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    warnings,
  };
}

/**
 * Get DATABASE_URL with validation
 */
export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("[DATABASE_ERROR] DATABASE_URL is not set");
    throw new Error("DATABASE_URL environment variable is required");
  }
  
  if (!isValidUrl(dbUrl)) {
    console.error("[DATABASE_ERROR] DATABASE_URL is not a valid URL");
    throw new Error("DATABASE_URL must be a valid URL");
  }
  
  return dbUrl;
}
