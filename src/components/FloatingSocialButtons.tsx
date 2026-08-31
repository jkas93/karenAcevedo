const SOCIAL_LINKS = [
  {
    name: 'TikTok',
    href: 'https://www.tiktok.com/@karenacevedo_chaclacayo',
    className: 'bg-gradient-to-br from-[#25F4EE] via-slate-950 to-[#FE2C55] focus-visible:ring-slate-400',
    iconClassName: 'bg-slate-950',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M19.32 5.56a5.17 5.17 0 0 1-3.01-1.52A5.17 5.17 0 0 1 14.79 1h-3.28v14.29a2.76 2.76 0 1 1-2.38-2.73V9.23a6.07 6.07 0 1 0 5.66 6.06V8.04a8.4 8.4 0 0 0 4.53 1.3V5.56Z" />
      </svg>
    ),
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/KarenAcevedoChaclacayo/',
    className: 'bg-gradient-to-br from-[#56a8ff] to-[#0b5dcc] focus-visible:ring-blue-300',
    iconClassName: 'bg-[#1877F2]',
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
      className="fixed z-40 flex items-center gap-1.5 rounded-full border border-white/80 bg-white/85 p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.20)] ring-1 ring-slate-900/5 backdrop-blur-xl sm:gap-2 sm:p-2"
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        right: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {SOCIAL_LINKS.map((social) => (
        <a
          key={social.name}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visitar ${social.name} de Karen Acevedo`}
          title={social.name}
          className={`group relative flex h-10 w-10 items-center justify-center rounded-full p-[2px] text-white shadow-md transition duration-200 hover:-translate-y-1 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 sm:h-12 sm:w-12 ${social.className}`}
        >
          <span className={`flex h-full w-full items-center justify-center rounded-full ${social.iconClassName}`}>
            {social.icon}
          </span>
          <span className="pointer-events-none absolute bottom-[calc(100%+0.65rem)] right-0 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:block">
            {social.name}
          </span>
        </a>
      ))}
    </nav>
  );
}
