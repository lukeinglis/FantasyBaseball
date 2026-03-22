import { loadDraftSession, saveDraftSession } from "@/lib/draft-store";

export async function GET() {
  return Response.json(loadDraftSession());
}

export async function POST(req: Request) {
  const body = await req.json();
  const session = loadDraftSession();

  if (body.action === "draft") {
    const name = body.player as string;
    if (!session.drafted.includes(name)) {
      session.drafted.push(name);
      if (body.isMine) session.myPicks.push(name);
    }
  } else if (body.action === "undo") {
    const last = session.drafted.pop();
    if (last) {
      const idx = session.myPicks.indexOf(last);
      if (idx !== -1) session.myPicks.splice(idx, 1);
    }
  } else if (body.action === "reset") {
    session.drafted = [];
    session.myPicks = [];
    session.myRoster = {};
  } else if (body.action === "assign") {
    session.myRoster[body.slot] = body.player;
  } else if (body.action === "unassign") {
    delete session.myRoster[body.slot];
  }

  saveDraftSession(session);
  return Response.json(session);
}
