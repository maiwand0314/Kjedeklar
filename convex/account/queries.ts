import { v } from "convex/values";
import { currentAuthUser } from "../auth";
import { unauthenticated } from "../lib/errors";
import { userQuery } from "../lib/tenant";

/** Innlogget brukers egen e-post og navn. */
export const me = userQuery({
  args: {},
  returns: v.object({ email: v.string(), name: v.string() }),
  handler: async (ctx) => {
    const user = await currentAuthUser(ctx);
    if (!user) throw unauthenticated();
    return { email: user.email, name: user.name };
  },
});
