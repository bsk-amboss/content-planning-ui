'use client';

export function SkeletonLine({
  width,
  height = 14,
}: {
  width: number | string;
  height?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 4,
        background:
          'linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.06) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
      }}
      aria-hidden
    />
  );
}
