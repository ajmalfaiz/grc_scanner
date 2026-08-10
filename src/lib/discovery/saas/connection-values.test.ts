import { describe, expect, it } from "vitest";

import {
  buildAuthHeaders,
  parseExtraHeaders,
  parseResourceList,
  validateSaasConnectionValues,
} from "@/lib/discovery/saas/connection-values";

describe("parseResourceList", () => {
  it("parses name:path pairs, one per line", () => {
    expect(parseResourceList("contacts:/api/v3/contacts\ncompanies:/api/v3/companies")).toEqual([
      { name: "contacts", path: "/api/v3/contacts" },
      { name: "companies", path: "/api/v3/companies" },
    ]);
  });

  it("derives a name from a bare path", () => {
    expect(parseResourceList("/api/v3/tickets")).toEqual([
      { name: "tickets", path: "/api/v3/tickets" },
    ]);
  });
});

describe("parseExtraHeaders", () => {
  it("parses Header: value lines", () => {
    expect(parseExtraHeaders("X-Api-Version: 2\nX-Tenant: acme")).toEqual({
      "X-Api-Version": "2",
      "X-Tenant": "acme",
    });
  });
});

describe("validateSaasConnectionValues", () => {
  it("requires baseUrl and at least one resource", () => {
    expect(() => validateSaasConnectionValues({})).toThrow(/baseUrl is required/);
    expect(() =>
      validateSaasConnectionValues({ baseUrl: "https://api.example.com", bearerToken: "t" }),
    ).toThrow(/resources is required/);
  });

  it("requires a bearer token for bearer auth", () => {
    expect(() =>
      validateSaasConnectionValues({
        baseUrl: "https://api.example.com",
        resources: "/contacts",
        authType: "bearer",
      }),
    ).toThrow(/bearerToken is required/);
  });

  it("requires tokenUrl, clientId, and clientSecret for OAuth2 client-credentials auth", () => {
    const base = { baseUrl: "https://api.example.com", resources: "/contacts", authType: "oauth2_client_credentials" };
    expect(() => validateSaasConnectionValues(base)).toThrow(/tokenUrl is required/);
    expect(() =>
      validateSaasConnectionValues({ ...base, tokenUrl: "https://api.example.com/oauth/token" }),
    ).toThrow(/clientId is required/);
    expect(() =>
      validateSaasConnectionValues({
        ...base,
        tokenUrl: "https://api.example.com/oauth/token",
        clientId: "abc",
      }),
    ).toThrow(/clientSecret is required/);

    const values = validateSaasConnectionValues({
      ...base,
      tokenUrl: "https://api.example.com/oauth/token",
      clientId: "abc",
      clientSecret: "shh",
    });
    expect(values.authType).toBe("oauth2_client_credentials");
    expect(values.tokenUrl).toBe("https://api.example.com/oauth/token");
  });

  it("accepts a full configuration", () => {
    const values = validateSaasConnectionValues({
      baseUrl: "https://api.example.com/",
      authType: "bearer",
      bearerToken: "secret-token",
      resources: "contacts:/api/v3/contacts",
    });
    expect(values.baseUrl).toBe("https://api.example.com");
    expect(values.resources).toEqual([{ name: "contacts", path: "/api/v3/contacts" }]);
  });
});

describe("buildAuthHeaders", () => {
  it("builds a bearer Authorization header", () => {
    const headers = buildAuthHeaders({
      baseUrl: "https://api.example.com",
      authType: "bearer",
      bearerToken: "abc123",
      resources: [],
    });
    expect(headers.Authorization).toBe("Bearer abc123");
  });

  it("builds a custom API key header", () => {
    const headers = buildAuthHeaders({
      baseUrl: "https://api.example.com",
      authType: "api_key",
      apiKeyHeader: "X-API-Key",
      apiKeyValue: "xyz",
      resources: [],
    });
    expect(headers["X-API-Key"]).toBe("xyz");
  });
});
