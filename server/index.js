import "dotenv/config";
import app from "./app.js";
import prisma from "./lib/prisma.js";

const port = Number(process.env.PORT ?? 3000);

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error("DATABASE_URL and JWT_SECRET must be set.");
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
