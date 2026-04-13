/**
 * PRISM Engine - Shared Type Definitions
 *
 * Central type exports for the engine module system.
 */

export type UserRole = 'crony' | 'contractor' | 'admin';

export type Env = {
  DB: D1Database;
  VAULT: R2Bucket;
  CONTRACTOR_LOCATIONS: DurableObjectNamespace;
  AI_ACTIVATED: string;
  OTPLESS_CLIENT_ID: string;
  OTPLESS_CLIENT_SECRET: string;
  SUPERTOKENS_CORE_URL: string;
  SUPERTOKENS_API_KEY: string;
  USE_SUPERTOKENS_AUTH: string;
  WEBHOOK_SECRET: string;
};

export interface User {
  id: string;
  role: UserRole;
  phoneNumber: string;
  regionScope: string | null;
  createdAt: Date | null;
  supervisorId: string | null;
  tags: string[];
  hierarchyDepth: number;
  reporterId: string | null;
  supertokensUserId: string | null;
}

export interface WhitelistedSource {
  id: string;
  linkedUserId: string | null;
  verifiedName: string;
  referenceId: string;
  approvalStatus: string;
  createdAt: Date | null;
}
