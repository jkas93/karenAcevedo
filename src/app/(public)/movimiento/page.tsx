'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Camera,
  Download,
  ExternalLink,
  MessageCircle,
  Music,
  Repeat1,
  Repeat2,
  Share2,
  SkipBack,
  SkipForward,
} from 'lucide-react';

const STICKER_PACK_URL = 'https://sticker.ly/s/5ZP3MN';
const STICKERS = [1, 2, 3, 4].map((number) => ({
  src: `/stickers/karen-acevedo/sticker-${String(number).padStart(2, '0')}.webp`,
  alt: `Sticker oficial de Karin Acevedo ${number}`,
}));

const PLAYLIST = [
  {
    title: 'Jingle oficial',
    subtitle: 'Fuerza Chaclacayo',
    src: '/jingle-karen-acevedo-2027.mp3',
    downloadName: 'jingle-karen-acevedo-2027.mp3',
  },
  {
    title: 'Gracias por su cariño',
    subtitle: 'Canción de campaña',
    src: '/audio/gracias-por-su-carino.mp3',
    downloadName: 'gracias-por-su-carino.mp3',
  },
  {
    title: 'Los jóvenes somos el cambio',
    subtitle: 'Canción de campaña',
    src: '/audio/los-jovenes-somos-el-cambio.mp3',
    downloadName: 'los-jovenes-somos-el-cambio.mp3',
  },
  {
    title: 'Chaclacayo, el verdadero cambio',
    subtitle: 'Canción de campaña',
    src: '/audio/chaclacayo-el-verdadero-cambio.mp3',
    downloadName: 'chaclacayo-el-verdadero-cambio.mp3',
  },
  {
    title: 'Un Chaclacayo seguro',
    subtitle: 'Canción de campaña',
    src: '/audio/un-chaclacayo-seguro.mp3',
    downloadName: 'un-chaclacayo-seguro.mp3',
  },
] as const;

type RepeatMode = 'off' | 'playlist' | 'track';

export default function MovimientoPage() {
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('playlist');
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrack = PLAYLIST[currentTrackIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    audio.play().catch(() => {
      // Algunos navegadores requieren interacción antes de reproducir audio.
    });
  }, [currentTrackIndex]);

  const playPrevious = () => {
    setCurrentTrackIndex((index) => (index - 1 + PLAYLIST.length) % PLAYLIST.length);
  };

  const playNext = () => {
    setCurrentTrackIndex((index) => (index + 1) % PLAYLIST.length);
  };

  const handleTrackEnded = () => {
    const hasNextTrack = currentTrackIndex < PLAYLIST.length - 1;
    if (hasNextTrack) {
      setCurrentTrackIndex((index) => index + 1);
    } else if (repeatMode === 'playlist') {
      setCurrentTrackIndex(0);
    }
  };

  const toggleRepeatMode = (mode: Exclude<RepeatMode, 'off'>) => {
    setRepeatMode((currentMode) => currentMode === mode ? 'off' : mode);
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-r from-slate-100 to-slate-200 py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="mb-4 text-4xl text-dark md:text-5xl">
            La campaña <span className="text-primary-dark">está en la calle</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-text sm:text-xl">
            Descarga y comparte nuestro material oficial para apoyar la campaña desde el mundo digital.
          </p>
        </div>
      </section>

      <main className="pb-28 sm:pb-24">
        <section aria-labelledby="playlist-heading" className="py-10 sm:py-16">
          <div className="mx-auto w-full max-w-5xl px-4">
            <div className="relative min-w-0 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-primary-dark p-4 text-white shadow-xl sm:rounded-3xl sm:p-7">
              <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />
              <div className="relative grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-6">
                <div className="min-w-0">
                  <div className="mb-4 flex items-center gap-3 sm:mb-5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 sm:h-12 sm:w-12">
                      <Music size={24} className="text-secondary" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary sm:text-xs sm:tracking-[0.2em]">Playlist oficial</p>
                      <h2 id="playlist-heading" className="mt-1 text-xl font-black sm:text-2xl">Música para el cambio</h2>
                    </div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/55">Reproduciendo</p>
                    <p aria-live="polite" className="mt-1 text-lg font-black">{currentTrack.title}</p>
                    <p className="text-sm text-white/65">{currentTrack.subtitle}</p>

                    <audio
                      ref={audioRef}
                      controls
                      autoPlay
                      preload="metadata"
                      src={currentTrack.src}
                      loop={repeatMode === 'track'}
                      onEnded={handleTrackEnded}
                      className="mt-4 block w-full max-w-full"
                    >
                      Tu navegador no soporta el elemento de audio.
                    </audio>

                    <div className="mt-4 flex min-w-0 items-center justify-center gap-2" aria-label="Controles de reproducción">
                      <button type="button" onClick={playPrevious} aria-label="Canción anterior" className="grid min-h-10 min-w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20 sm:min-h-11 sm:min-w-11">
                        <SkipBack size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label="Repetir la canción actual"
                        title="Repetir canción"
                        aria-pressed={repeatMode === 'track'}
                        onClick={() => toggleRepeatMode('track')}
                        className={`grid min-h-10 min-w-10 shrink-0 place-items-center rounded-full border transition sm:min-h-11 sm:min-w-11 ${
                          repeatMode === 'track'
                            ? 'border-secondary/50 bg-secondary/20 text-white'
                            : 'border-white/15 bg-white/10 text-white/65 hover:bg-white/20'
                        }`}
                      >
                        <Repeat1 size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label="Repetir la lista completa"
                        title="Repetir lista"
                        aria-pressed={repeatMode === 'playlist'}
                        onClick={() => toggleRepeatMode('playlist')}
                        className={`grid min-h-10 min-w-10 shrink-0 place-items-center rounded-full border transition sm:min-h-11 sm:min-w-11 ${
                          repeatMode === 'playlist'
                            ? 'border-secondary/50 bg-secondary/20 text-white'
                            : 'border-white/15 bg-white/10 text-white/65 hover:bg-white/20'
                        }`}
                      >
                        <Repeat2 size={18} />
                      </button>
                      <button type="button" onClick={playNext} aria-label="Siguiente canción" className="grid min-h-10 min-w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/20 sm:min-h-11 sm:min-w-11">
                        <SkipForward size={18} />
                      </button>
                    </div>
                    <p aria-live="polite" className="mt-2 min-h-4 text-center text-[10px] font-bold uppercase tracking-wider text-secondary/80">
                      {repeatMode === 'track' ? 'Repetir canción' : repeatMode === 'playlist' ? 'Repetir lista' : 'Sin repetición'}
                    </p>
                    <p className="mt-3 text-center text-[11px] leading-5 text-white/50">
                      Las canciones avanzan automáticamente. La reproducción puede requerir un toque inicial según el navegador.
                    </p>
                  </div>
                </div>

                <ol className="min-w-0 space-y-2" aria-label="Canciones disponibles">
                  {PLAYLIST.map((track, index) => {
                    const active = index === currentTrackIndex;
                    return (
                      <li key={track.src} className={`flex min-w-0 items-center gap-1.5 rounded-2xl border p-1.5 transition sm:gap-2 sm:p-2 ${active ? 'border-secondary/50 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                        <button type="button" onClick={() => setCurrentTrackIndex(index)} aria-current={active ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-2 text-left sm:gap-3 sm:px-2">
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black ${active ? 'bg-secondary text-slate-950' : 'bg-white/10 text-white/70'}`}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-bold leading-5">{track.title}</span>
                            <span className="block truncate text-xs text-white/50">{active ? 'Sonando ahora' : track.subtitle}</span>
                          </span>
                        </button>
                        <a href={track.src} download={track.downloadName} aria-label={`Descargar ${track.title}`} className="grid min-h-10 min-w-10 shrink-0 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-secondary">
                          <Download size={17} />
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="kit-digital-heading" className="pb-8 pt-2 sm:pb-12 sm:pt-4">
          <div className="mx-auto w-full max-w-5xl px-4">
            <div className="mb-6 flex items-center gap-3 sm:mb-8">
              <Share2 className="text-primary-dark" size={32} />
              <h2 id="kit-digital-heading" className="m-0 text-3xl text-dark">Kit Digital</h2>
            </div>
            <p className="mb-8 text-text">
              Haz campaña desde tu celular. Las elecciones se ganan sumando a más vecinos cada día. ¡Descarga y comparte en tus redes!
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <article className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
                <div className="grid grid-cols-4 gap-1.5" aria-label="Vista previa del paquete de stickers">
                  {STICKERS.map((sticker) => (
                    <div key={sticker.src} className="aspect-square overflow-hidden rounded-xl bg-white ring-1 ring-emerald-100">
                      <Image src={sticker.src} alt={sticker.alt} width={96} height={96} className="h-full w-full object-contain p-1" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2 text-dark">
                  <MessageCircle size={22} className="shrink-0 text-emerald-600" />
                  <h3 className="font-bold">Stickers de WhatsApp</h3>
                </div>
                <p className="mt-1 text-xs leading-5 text-text">
                  Abre el paquete oficial en Sticker.ly y agrégalo a WhatsApp.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <a href={STICKER_PACK_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">
                    Agregar a WhatsApp <ExternalLink size={16} />
                  </a>
                  <a href="/stickers/karen-acevedo/stickers-karen-acevedo.zip" download="stickers-karen-acevedo.zip" className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100">
                    Descargar paquete ZIP <Download size={14} />
                  </a>
                </div>
              </article>

              <button type="button" disabled title="Próximamente" className="group flex min-h-64 cursor-not-allowed flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8 opacity-70">
                <Camera size={40} className="mb-4 text-secondary transition-transform group-hover:scale-110" />
                <span className="font-bold text-dark">Stories para IG</span>
                <span className="mt-2 text-xs text-text">Próximamente</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
