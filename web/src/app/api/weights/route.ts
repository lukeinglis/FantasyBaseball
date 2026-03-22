import { getCategoryWeights } from "@/lib/data";

export async function GET() {
  const data = await getCategoryWeights();
  if (!data) return Response.json({ error: "No weights data" }, { status: 404 });
  return Response.json(data);
}
