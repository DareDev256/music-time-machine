import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { getSongData } from "@/lib/dataFetcher";
import { checkRouteLimit, extractClientIp, rateLimitResponse } from "@/lib/rateLimit";

export const runtime = "edge";

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9\-:]+$/.test(id) && id.length <= 200;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = extractClientIp(request);
  if (!checkRouteLimit("og", clientIp)) {
    return rateLimitResponse();
  }

  const { id } = await params;

  if (!isValidId(id)) {
    return new Response(JSON.stringify({ error: "Invalid song ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const song = await getSongData(id);
  if (!song) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            background: "#000",
            color: "#fff",
            fontSize: 48,
            fontFamily: "sans-serif",
          }}
        >
          Song Not Found
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1C1C1E 0%, #000 100%)",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        {/* Album Art */}
        <div
          style={{
            display: "flex",
            width: 400,
            height: 400,
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            marginRight: 60,
            flexShrink: 0,
          }}
        >
          {song.albumArt ? (
            /* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- @vercel/og ImageResponse requires <img>, not next/image */
            <img
              src={song.albumArt}
              width={400}
              height={400}
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#38383A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#86868B",
                fontSize: 80,
              }}
            >
              ♪
            </div>
          )}
        </div>

        {/* Info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#F5F5F7",
              lineHeight: 1.1,
              marginBottom: 16,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {song.title}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#86868B",
              marginBottom: 40,
            }}
          >
            {song.artist}
          </div>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: 40 }}>
            {song.spotify && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#1DB954" }}>
                  {song.spotify.totalStreams}
                </div>
                <div style={{ fontSize: 16, color: "#86868B" }}>Streams</div>
              </div>
            )}
            {song.youtube && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#FF0000" }}>
                  {song.youtube.viewCount}
                </div>
                <div style={{ fontSize: 16, color: "#86868B" }}>Views</div>
              </div>
            )}
            {song.billboard && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#FBBF24" }}>
                  #{song.billboard.peakPosition}
                </div>
                <div style={{ fontSize: 16, color: "#86868B" }}>Billboard Peak</div>
              </div>
            )}
          </div>

          {/* Branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 40,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                background: "#FC3C44",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 18,
              }}
            >
              ♪
            </div>
            <div style={{ fontSize: 18, color: "#86868B" }}>
              Music Time Machine
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
