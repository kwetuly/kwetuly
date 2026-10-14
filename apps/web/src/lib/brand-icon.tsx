// The Rafrika app icon: a white lowercase "r" with the rising sun, on night green.
// Rendered with next/og for the browser tab icon and the Apple home-screen icon.
export function BrandIcon({ size, rounded }: { size: number; rounded: boolean }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a1f17',
        borderRadius: rounded ? size * 0.22 : 0,
        position: 'relative',
      }}
    >
      <div
        style={{
          color: '#ffffff',
          fontSize: size * 0.78,
          fontWeight: 800,
          lineHeight: 1,
          marginTop: -size * 0.1,
          marginLeft: -size * 0.06,
          fontFamily: 'sans-serif',
        }}
      >
        r
      </div>
      <div
        style={{
          position: 'absolute',
          top: size * 0.16,
          right: size * 0.16,
          width: size * 0.24,
          height: size * 0.24,
          borderRadius: size,
          background: '#ffb627',
        }}
      />
    </div>
  );
}
