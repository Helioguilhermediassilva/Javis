import { describe, expect, it } from "vitest";
import { hasXavierEntitlement, resolveXavierEntitlements } from "./xavierEntitlements";

describe("xavier entitlements", () => {
  it("preserves the current operational limit when a profile already has one", () => {
    const entitlements = resolveXavierEntitlements({
      plan: "individual",
      billingStatus: "inactive",
      monthlyMessageLimit: 2400,
      memoryEnabled: true,
    });

    expect(entitlements.plan).toBe("individual");
    expect(entitlements.billingStatus).toBe("inactive");
    expect(entitlements.monthlyMessageLimit).toBe(2400);
    expect(hasXavierEntitlement(entitlements, "memory")).toBe(true);
    expect(hasXavierEntitlement(entitlements, "telegram")).toBe(true);
  });

  it("falls back safely for unknown commercial values", () => {
    const entitlements = resolveXavierEntitlements({
      plan: "unknown",
      billingStatus: "unknown",
      monthlyMessageLimit: "not-a-number",
      memoryEnabled: false,
    });

    expect(entitlements.plan).toBe("individual");
    expect(entitlements.billingStatus).toBe("inactive");
    expect(entitlements.monthlyMessageLimit).toBe(1000);
    expect(hasXavierEntitlement(entitlements, "memory")).toBe(false);
  });

  it("allows only explicit boolean feature overrides", () => {
    const entitlements = resolveXavierEntitlements({
      plan: "pro",
      override: {
        voice: false,
        artifacts: "false",
        crm: true,
      },
    });

    expect(hasXavierEntitlement(entitlements, "voice")).toBe(false);
    expect(hasXavierEntitlement(entitlements, "artifacts")).toBe(true);
    expect(hasXavierEntitlement(entitlements, "crm")).toBe(true);
  });
});
