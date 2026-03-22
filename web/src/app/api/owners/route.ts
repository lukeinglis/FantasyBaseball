import { getOwnerSeasons } from "@/lib/data";

export async function GET() {
  return Response.json(await getOwnerSeasons());
}
