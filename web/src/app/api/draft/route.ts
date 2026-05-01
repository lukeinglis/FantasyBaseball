import type { DraftSession } from "@/lib/draft-context";
import logger from "@/lib/logger";

const EMPTY: DraftSession = { drafted: [], myPicks: [], myRoster: {} };

export async function GET(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  log.info({ op: "draft-get" }, "ok");
  return Response.json(EMPTY);
}

export async function POST(req: Request) {
  const reqId = crypto.randomUUID();
  const log = logger.child({ reqId, path: new URL(req.url).pathname });
  const body = await req.json();

  if (body.action === "reset") {
    log.info({ op: "draft-reset" }, "ok");
    return Response.json(EMPTY);
  }

  log.info({ op: "draft-update" }, "ok");
  return Response.json(body.session ?? EMPTY);
}
