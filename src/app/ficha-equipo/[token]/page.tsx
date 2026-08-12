import Image from 'next/image';
import { notFound } from 'next/navigation';
import { TeamIntakeForm } from '@/components/team-intake/TeamIntakeForm';
import { getTeamInvitation } from '@/lib/server/team-intake';

export const dynamic = 'force-dynamic';

export default async function TeamIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!(await getTeamInvitation(token))) notFound();

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-6 sm:px-6 sm:py-10'>
      <div className='mx-auto max-w-4xl'>
        <header className='mb-6 rounded-[2rem] bg-gradient-to-br from-[#003d72] via-[#005a9c] to-[#0798cf] p-5 text-white shadow-xl sm:p-8'>
          <div className='flex items-center gap-4'>
            <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-sm sm:h-20 sm:w-20'>
              <Image src='/brazo.png' alt='Fuerza Ciudadana' width={64} height={64} className='h-full w-full object-contain' priority />
            </div>
            <div>
              <p className='text-xs font-extrabold uppercase tracking-[0.18em] text-yellow-300'>Equipo Karen Acevedo</p>
              <h1 className='mt-1 text-2xl font-black leading-tight sm:text-4xl'>Ficha de registro del equipo de trabajo</h1>
            </div>
          </div>
          <p className='mt-5 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base'>
            Esta ficha está dirigida exclusivamente al equipo operativo de la campaña. La información nos ayudará a organizar actividades y aprovechar mejor las capacidades y disponibilidad de cada integrante.
          </p>
        </header>
        <TeamIntakeForm token={token} />
        <p className='mt-5 text-center text-xs leading-5 text-slate-400'>Este formulario no otorga acceso al sistema administrativo.</p>
      </div>
    </div>
  );
}
