import { NextResponse } from 'next/server';

const ALLOWED_SIZES = new Set([192, 512]);

export async function GET(
  request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  const parsed = Number(rawSize);
  const size = ALLOWED_SIZES.has(parsed) ? parsed : 512;
  const iconUrl = new URL(`/pwa-icon-${size}.png`, request.url);
  iconUrl.searchParams.set('v', 'brazo-2');
  return NextResponse.redirect(iconUrl, 307);
}
