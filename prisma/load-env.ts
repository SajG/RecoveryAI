import { config } from "dotenv";
import { resolve } from "node:path";

// tsx does not load .env like Next.js; run before PrismaClient is constructed.
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });
