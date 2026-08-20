export type XavierPlan = "individual" | "pro" | "business";
export type XavierBillingStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled";

export interface XavierEntitlements {
  plan: XavierPlan;
  billingStatus: XavierBillingStatus;
  monthlyMessageLimit: number;
  memory: boolean;
  voice: boolean;
  artifacts: boolean;
  telegram: boolean;
  crm: boolean;
  webResearch: boolean;
}

const PLAN_DEFAULTS: Record<XavierPlan, Omit<XavierEntitlements, "plan" | "billingStatus">> = {
  individual: {
    monthlyMessageLimit: 1000,
    memory: true,
    voice: true,
    artifacts: true,
    telegram: true,
    crm: true,
    webResearch: true,
  },
  pro: {
    monthlyMessageLimit: 5000,
    memory: true,
    voice: true,
    artifacts: true,
    telegram: true,
    crm: true,
    webResearch: true,
  },
  business: {
    monthlyMessageLimit: 20000,
    memory: true,
    voice: true,
    artifacts: true,
    telegram: true,
    crm: true,
    webResearch: true,
  },
};

const VALID_PLANS = new Set<XavierPlan>(["individual", "pro", "business"]);
const VALID_BILLING_STATUSES = new Set<XavierBillingStatus>([
  "inactive",
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

function normalizePlan(value: unknown): XavierPlan {
  return typeof value === "string" && VALID_PLANS.has(value as XavierPlan)
    ? (value as XavierPlan)
    : "individual";
}

function normalizeBillingStatus(value: unknown): XavierBillingStatus {
  return typeof value === "string" && VALID_BILLING_STATUSES.has(value as XavierBillingStatus)
    ? (value as XavierBillingStatus)
    : "inactive";
}

function normalizeLimit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(10, Math.min(100_000, Math.round(value)));
}

function overrideBoolean(overrides: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return typeof overrides[key] === "boolean" ? overrides[key] as boolean : fallback;
}

export function resolveXavierEntitlements(input: {
  plan?: unknown;
  billingStatus?: unknown;
  monthlyMessageLimit?: unknown;
  memoryEnabled?: unknown;
  override?: unknown;
}): XavierEntitlements {
  const plan = normalizePlan(input.plan);
  const billingStatus = normalizeBillingStatus(input.billingStatus);
  const defaults = PLAN_DEFAULTS[plan];
  const overrides = input.override && typeof input.override === "object" && !Array.isArray(input.override)
    ? input.override as Record<string, unknown>
    : {};

  return {
    plan,
    billingStatus,
    monthlyMessageLimit: normalizeLimit(input.monthlyMessageLimit, defaults.monthlyMessageLimit),
    memory: overrideBoolean(overrides, "memory", input.memoryEnabled !== false && defaults.memory),
    voice: overrideBoolean(overrides, "voice", defaults.voice),
    artifacts: overrideBoolean(overrides, "artifacts", defaults.artifacts),
    telegram: overrideBoolean(overrides, "telegram", defaults.telegram),
    crm: overrideBoolean(overrides, "crm", defaults.crm),
    webResearch: overrideBoolean(overrides, "webResearch", defaults.webResearch),
  };
}

export function hasXavierEntitlement(
  entitlements: XavierEntitlements,
  feature: Exclude<keyof XavierEntitlements, "plan" | "billingStatus" | "monthlyMessageLimit">,
): boolean {
  return entitlements[feature] === true;
}
