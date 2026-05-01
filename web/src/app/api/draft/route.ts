import type { DraftSession } from "@/lib/draft-context";

const EMPTY: DraftSession = { drafted: [], myPicks: [], myRoster: {} };

export async function GET() {
  return Response.json(EMPTY);
}

export async function POST(req: Request) {
  const body = await req.json();

  if (body.action === "reset") {
    return Response.json(EMPTY);
  }

  return Response.json(body.session ?? EMPTY);
}
