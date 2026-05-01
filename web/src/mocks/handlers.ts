import { http, HttpResponse } from "msw";

export const handlers = [
  http.get(
    "https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/*/segments/0/leagues/*",
    ({ request }) => {
      const url = new URL(request.url);
      const views = url.searchParams.getAll("view");

      if (views.includes("mMatchupScore") || views.includes("mMatchup")) {
        return HttpResponse.json({
          status: { currentMatchupPeriod: 3 },
          settings: { scheduleSettings: { matchupPeriodCount: 21 } },
          teams: [],
          schedule: [],
        });
      }

      return HttpResponse.json({
        teams: [],
        players: [],
        status: { currentMatchupPeriod: 1 },
        settings: { scheduleSettings: { matchupPeriodCount: 21 } },
      });
    },
  ),
];
