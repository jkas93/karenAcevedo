const SOCIAL_LINKS = [
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@karenacevedo_chaclacayo',
    className: 'bg-slate-950 hover:bg-black focus-visible:ring-slate-400',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M19.32 5.56a5.17 5.17 0 0 1-3.01-1.52A5.17 5.17 0 0 1 14.79 1h-3.28v14.29a2.76 2.76 0 1 1-2.38-2.73V9.23a6.07 6.07 0 1 0 5.66 6.06V8.04a8.4 8.4 0 0 0 4.53 1.3V5.56Z" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/KarenAcevedoChaclacayo/',
    className: 'bg-[#1877F2] hover:bg-[#0f68dc] focus-visible:ring-blue-300',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
      </svg>
    ),
  },
] as const;

export default function FloatingSocialButtons() {
  return (
    <nav
      aria-label="Redes sociales de Karen Acevedo"
      className="fixed bottom-24 right-3 z-40 flex flex-col gap-3 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
    >
      {SOCIAL_LINKS.map((social) => (
        <a
          key={social.name}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visitar ${social.name} de Karen Acevedo`}
          title={social.name}
          className={`group relative flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ring-1 ring-white/70 transition duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-4 ${social.className}`}
        >
          {social.icon}
          <span className="pointer-events-none absolute right-[calc(100%+0.6rem)] hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:block">
            {social.name}
          </span>
        </a>
      ))}
    </nav>
  );
}
