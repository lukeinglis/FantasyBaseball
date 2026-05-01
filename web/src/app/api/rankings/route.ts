import { getRankings } from "@/lib/data";
import logger from "@/lib/logger";

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  const t0 = Date.now();
  const data = await getRankings();
  log.info({ op: "rankings", durationMs: Date.now() - t0 }, "ok");
  return Response.json(data);
}
