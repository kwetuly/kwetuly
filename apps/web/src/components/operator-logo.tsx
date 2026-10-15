// An operator's logo, or its first letter on green when there is no logo.
export function OperatorLogo({ name, logo, size = 44 }: { name: string; logo: string | null; size?: number }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" width={size} height={size} className="shrink-0 rounded-[5px] border border-line bg-white object-contain" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-[5px] bg-leaf font-extrabold text-white" style={{ width: size, height: size }} aria-hidden>
      {name.charAt(0)}
    </span>
  );
}
