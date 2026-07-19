/**
 * Environment Variable Validation
 * Ensures all required environment variables are present in production
 * Uses strict type safety with type guards for union narrowing
 */

export interface EnvValidation {
  valid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
}

// Type definitions for strict union handling
const REQUIRED_VARS = [
  "DATABASE_URL",
] as const;

const OPTIONAL_VARS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_API_URL",
  "LICHESS_TOKEN",
  "NODE_ENV",
  "CRON_SECRET",
] as const;

const URL_VARS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_API_URL",
] as const;

// Derived types from const assertions
type RequiredVar = typeof REQUIRED_VARS[number];
type OptionalVar = typeof OPTIONAL_VARS[number];
type UrlVar = typeof URL_VARS[number];

/**
 * Type guard: checks if a string is a valid URL variable name
 * This allows safe narrowing from string to UrlVar union
 */
function isUrlVar(varName: string): varName is UrlVar {
  return (URL_VARS as readonly string[]).includes(varName);
}

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
    } else if (isUrlVar(varName) && !isValidUrl(value)) {
      invalid.push(varName);
    }
  }

  // Check optional variables and log warnings
  for (const varName of OPTIONAL_VARS) {
    const value = process.env[varName];
    if (!value && varName !== "LICHESS_TOKEN") {
      warnings.push(`${varName} is not set`);
    } else if (isUrlVar(varName) && value && !isValidUrl(value)) {
      invalid.push(varName);
    }
  }

  // Log validation results
  if (missing.length > 0) {
    console.error("[ENV_ERROR] Missing required environment variables:", missing);
  }
  
  if (invalid.length > 0) {
    console.error("[ENV_ERROR] Invalid environment variables:", invalid);
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
 * WARNING: Only call at runtime, not during build phase
 */
export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("[DATABASE_ERROR] DATABASE_URL is not set");
    // Return empty string instead of throwing to allow build to complete
    // Database operations will fail at runtime if env var is missing
    return "";
  }
  
  if (!isValidUrl(dbUrl)) {
    console.error("[DATABASE_ERROR] DATABASE_URL is not a valid URL");
    // Return empty string instead of throwing to allow build to complete
    return "";
  }
  
  return dbUrl;
}
