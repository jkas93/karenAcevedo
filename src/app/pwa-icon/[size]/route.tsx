import { ImageResponse } from 'next/og';

const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(
  request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  const parsed = Number(rawSize);
  const size = ALLOWED_SIZES.has(parsed) ? parsed : 512;
  const logoUrl = new URL('/brazo.png', request.url).toString();

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
          background: 'linear-gradient(145deg, #f8fbff 0%, #e9f6ff 55%, #d8f1ff 100%)',
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
            background: 'rgba(255, 204, 0, 0.3)',
          }}
        />
        <div
          style={{
            width: '84%',
            height: '84%',
            borderRadius: '24%',
            border: '4px solid rgba(0,112,192,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.88)',
            boxShadow: '0 18px 60px rgba(0,73,126,0.16)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse requiere img. */}
          <img
            src={logoUrl}
            alt=""
            style={{
              width: '76%',
              height: '76%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 10px 12px rgba(0,73,126,0.18))',
            }}
          />
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
