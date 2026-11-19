const links = [
  { path: '/', label: 'Workbench' },
  { path: '/data', label: 'Data explorer' },
  { path: '/guide', label: 'How it works' },
] as const

export default function SiteNav({ current }: { current: typeof links[number]['path'] }) {
  return <nav className="site-nav" aria-label="Main navigation">
    {links.map(({ path, label }) =>
      <a key={path} href={path} aria-current={path === current ? 'page' : undefined}>{label}</a>
    )}
  </nav>
}
