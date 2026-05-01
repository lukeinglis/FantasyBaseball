import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../mocks/node";

describe("ESPN API via MSW", () => {
  beforeEach(() => {
    vi.stubEnv("ESPN_S2", "fake-s2-token");
    vi.stubEnv("ESPN_SWID", "{FAKE-SWID}");
  });

  it("espnFetch throws when credentials are missing", async () => {
    vi.stubEnv("ESPN_S2", "");
    vi.stubEnv("ESPN_SWID", "");

    const { espnFetch } = await import("@/lib/espn");
    await expect(espnFetch(["mTeam"])).rejects.toThrow("ESPN_CREDS_MISSING");
  });

  it("MSW intercepts ESPN API requests and returns mock data", async () => {
    server.use(
      http.get(
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/*/segments/0/leagues/*",
        () => {
          return HttpResponse.json({
            teams: [
              { id: 1, name: "Test Team" },
              { id: 2, name: "Other Team" },
            ],
          });
        },
      ),
    );

    const { espnFetch } = await import("@/lib/espn");
    const data = (await espnFetch(["mTeam"])) as { teams: { id: number; name: string }[] };
    expect(data.teams).toHaveLength(2);
    expect(data.teams[0].name).toBe("Test Team");
  });

  it("espnFetch throws on HTTP error responses", async () => {
    server.use(
      http.get(
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/*/segments/0/leagues/*",
        () => {
          return new HttpResponse(null, { status: 503 });
        },
      ),
    );

    const { espnFetch } = await import("@/lib/espn");
    await expect(espnFetch(["mTeam"])).rejects.toThrow("ESPN API 503");
  });
});
