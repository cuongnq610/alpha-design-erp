// ALPHA DESIGN ERP Cloud v4.5.67 — DEMO recycle-bin runtime configuration.
// This file contains no secret. Do not put a service-role key in browser code.
window.ALPHA_RUNTIME_CONFIG = {
  releaseVersion: "4.5.67",
  environment: "demo",
  dataMode: "demo-compatible",
  apiBaseUrl: "",
  requireServerForProduction: true,
  apiAuthRequired: false,
  allowDemoLogin: true,
  allowLocalBusinessData: true,
  allowOfflineWritesInProduction: false,
  sessionPersistence: "session",
  sessionIdleTimeoutMs: 1800000,
  sessionAbsoluteTimeoutMs: 28800000,
  requireMfaForPrivilegedRoles: true,
  supabaseUrl: "",
  supabaseAnonKey: "",
  companyCode: "ALPHA-DEMO",
  companyName: "ALPHA DESIGN — DEMO",
  ownerFullName: "Giám đốc Demo",
  autoProvisionFirstUser: false,
  enableRealtime: false,
  syncIntervalMs: 10000,
  bootstrapDemoData: true
};
