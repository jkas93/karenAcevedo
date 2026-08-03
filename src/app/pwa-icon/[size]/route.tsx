import { ImageResponse } from 'next/og';

const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  const parsed = Number(rawSize);
  const size = ALLOWED_SIZES.has(parsed) ? parsed : 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #003f73 0%, #0070c0 60%, #08a0d5 100%)',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '72%',
            height: '72%',
            borderRadius: '50%',
            right: '-25%',
            top: '-25%',
            background: 'rgba(255, 204, 0, 0.23)',
          }}
        />
        <div
          style={{
            width: '78%',
            height: '78%',
            borderRadius: '25%',
            border: '4px solid rgba(255,255,255,0.28)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.1)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: size * 0.38,
              lineHeight: 0.9,
              fontWeight: 900,
              letterSpacing: -size * 0.03,
            }}
          >
            K
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: size * 0.045,
              fontSize: size * 0.065,
              fontWeight: 800,
              letterSpacing: size * 0.012,
              textTransform: 'uppercase',
            }}
          >
            EQUIPO KAREN
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
  );
}
