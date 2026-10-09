// The small-caps label that heads each panel section: Naskah, Template,
// Ukuran halaman, Spesifikasi. One style, so panels cannot drift apart.

export function PanelLabel({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span className={`text-2xs font-medium uppercase tracking-[0.12em] text-muted ${className}`}>
      {children}
    </span>
  );
}
