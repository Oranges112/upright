import { pushEnabled, syncEnabled, vapidPublicKey } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    sync: syncEnabled,
    push: pushEnabled,
    vapidPublicKey: pushEnabled ? vapidPublicKey : undefined,
  });
}
