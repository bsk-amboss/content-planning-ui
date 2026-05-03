import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { requireUserResponse } from '@/lib/auth';
import { deleteMilestoneSource } from '@/lib/data/milestone-sources';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const guard = await requireUserResponse();
  if (guard) return guard;
  const { slug } = await params;
  await deleteMilestoneSource(slug);
  revalidateTag('milestone-sources', 'max');
  return NextResponse.json({ ok: true });
}
