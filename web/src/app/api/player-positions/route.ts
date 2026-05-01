import { getPlayerPositions } from "@/lib/data";
import logger from "@/lib/logger";

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  const t0 = Date.now();
  const data = await getPlayerPositions();
  log.info({ op: "player-positions", durationMs: Date.now() - t0 }, "ok");
  return Response.json(data);
}
