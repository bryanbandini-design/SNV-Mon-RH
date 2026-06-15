import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"

function getDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
  const filePart = url.replace(/^file:/, "")
  // resolve relative paths from project root
  return path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), filePart)
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: getDbPath() })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
