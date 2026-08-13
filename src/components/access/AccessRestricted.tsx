import { LockKeyhole, ShieldAlert } from 'lucide-react';

export function AccessRestricted({ moduleName }: { moduleName: string }) {
  return (
    <div className="mx-auto max-w-5xl" role="alert">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-white/55 backdrop-blur-[2px]" />
        <div className="grid gap-4 opacity-35 md:grid-cols-3" aria-hidden="true">
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="h-64 rounded-2xl bg-slate-100 md:col-span-2" />
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <div className="max-w-md rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <LockKeyhole size={30} />
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-700">
              <ShieldAlert size={15} /> Acceso restringido
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900">{moduleName}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tu rol actual no cuenta con permisos para abrir este módulo. Los datos y acciones permanecen deshabilitados.
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Solicita al Modo Dios que revise los permisos de tu rol en Gestión de Accesos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
