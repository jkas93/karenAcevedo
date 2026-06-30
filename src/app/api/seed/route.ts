import { NextResponse } from 'next/server';
import { seedColegiosChaclacayo } from '@/lib/firebase/seed-chaclacayo';

export async function GET() {
  try {
    await seedColegiosChaclacayo();
    return NextResponse.json({ message: 'Seeding completado exitosamente.' });
  } catch (error: any) {
    console.error('Error seeding DB:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
