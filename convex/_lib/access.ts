import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { DataModel } from '../_generated/dataModel';
import { auth } from '../auth';

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

// Add to any function callable from the workflow runtime or local scripts —
// callers pass `process.env.WORKFLOW_SECRET`. UI / browser callers leave it
// undefined and get authed via the user's JWT.
export const serviceSecretArg = v.optional(v.string());

export async function requireUser(ctx: Ctx): Promise<void> {
  const userId = await auth.getUserId(ctx);
  if (!userId) throw new ConvexError('Unauthorized');
}

export async function requireUserOrService(
  ctx: Ctx,
  secret: string | undefined,
): Promise<void> {
  if (typeof secret === 'string' && secret.length > 0) {
    const expected = process.env.WORKFLOW_SECRET;
    if (!expected) throw new ConvexError('WORKFLOW_SECRET not configured');
    if (secret !== expected) throw new ConvexError('Unauthorized');
    return;
  }
  const userId = await auth.getUserId(ctx);
  if (!userId) throw new ConvexError('Unauthorized');
}

export async function requireService(secret: string | undefined): Promise<void> {
  const expected = process.env.WORKFLOW_SECRET;
  if (!expected) throw new ConvexError('WORKFLOW_SECRET not configured');
  if (secret !== expected) throw new ConvexError('Unauthorized');
}
