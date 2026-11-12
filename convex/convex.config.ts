import betterAuth from "@convex-dev/better-auth/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(betterAuth);
// Én kø for bakgrunnsjobber (convex/jobs). Begrenser hvor mange som kjører samtidig.
app.use(workpool, { name: "jobWorkpool" });

export default app;
