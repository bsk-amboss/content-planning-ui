import { SkeletonLine } from './_components/skeleton';

export default function PlanningLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SkeletonLine width={280} height={28} />
        <SkeletonLine width={420} height={14} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {['a', 'b', 'c', 'd'].map((k) => (
          <div
            key={k}
            style={{
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: '#fff',
            }}
          >
            <SkeletonLine width={'60%'} height={12} />
            <SkeletonLine width={'40%'} height={24} />
            <SkeletonLine width={'80%'} height={12} />
          </div>
        ))}
      </div>
    </div>
  );
}
