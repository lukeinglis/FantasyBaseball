import { espnFetch, hasEspnCreds } from "@/lib/espn";

export async function GET() {
  if (!hasEspnCreds()) return Response.json({ error: "ESPN_CREDS_MISSING" }, { status: 401 });
  try {
    const data: any = await espnFetch(["mSettings"]);
    const slotCounts = data.settings?.rosterSettings?.lineupSlotCounts ?? {};
    const slotNames = data.settings?.rosterSettings?.lineupSlotStatuses ?? {};
    return Response.json({
      lineupSlotCounts: slotCounts,
      lineupSlotStatuses: slotNames,
      rosterSettings: data.settings?.rosterSettings,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
