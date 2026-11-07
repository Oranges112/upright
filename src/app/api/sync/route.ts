import { CODE_RE, bad, saveMerged, syncEnabled } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!syncEnabled) return bad("Sync not configured", 501);
  const raw = await req.text();
  if (raw.length > 900_000) return bad("Payload too large", 413);
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return bad("Invalid JSON");
  }
  const code = String(body?.code ?? "");
  if (!CODE_RE.test(code)) return bad("Invalid code");
  if (!body.doc || typeof body.doc !== "object") return bad("Missing doc");
  const doc = await saveMerged(code, body.doc);
  return Response.json({ doc });
}
