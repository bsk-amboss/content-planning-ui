import { query } from './_generated/server';
import { auth } from './auth';

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
    };
  },
});
