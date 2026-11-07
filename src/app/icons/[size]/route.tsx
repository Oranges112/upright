import { ImageResponse } from "next/og";

const SIZES = new Set([96, 180, 192, 512]);

export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const maskable = new URL(req.url).searchParams.has("maskable");
  const s = size / 100;
  const inset = maskable ? 0.7 : 1;
  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0f1a33 0%, #0b1020 100%)",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transform: `scale(${inset})`,
          }}
        >
          <div
            style={{
              width: 26 * s,
              height: 26 * s,
              borderRadius: 999,
              background: "linear-gradient(135deg, #5eead4, #38bdf8)",
            }}
          />
          <div
            style={{
              width: 9 * s,
              height: 46 * s,
              marginTop: 5 * s,
              borderRadius: 99 * s,
              background: "linear-gradient(180deg, #38bdf8, #a78bfa)",
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
