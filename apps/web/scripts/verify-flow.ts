import { PrismaClient } from "@prisma/client";
import { refreshFestivalEvidence } from "../lib/kto/refresh";

const prisma = new PrismaClient();

async function main() {
  const result = await refreshFestivalEvidence("seed-spring-flower");
  if (result.reason !== "no_key") {
    throw new Error(`expected no_key fallback, got ${result.reason}`);
  }

  const quality = await prisma.dataQuality.findFirst({
    where: { festivalId: "seed-spring-flower", status: "key_absent" },
  });
  if (!quality) throw new Error("key-absent quality row missing");

  const logs = await prisma.apiCallLog.count();
  if (logs < 1) throw new Error("api logs missing");

  console.log("refresh fallback ok, logs", logs);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
