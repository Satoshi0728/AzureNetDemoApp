import { createApp } from "./app.js";
import { logSecurityHints } from "./config/env.js";

const { app, port } = createApp();

app.listen(port, () => {
  console.log(`Server ready on port ${port}`);
});

logSecurityHints();
