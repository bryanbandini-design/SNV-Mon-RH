import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import bcrypt from "bcryptjs"
import path from "path"

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
const filePart = dbUrl.replace(/^file:/, "")
const dbPath = path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), filePart)

const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10)

  const user = await prisma.user.upsert({
    where: { email: "admin@monrh.com" },
    update: {},
    create: {
      email: "admin@monrh.com",
      passwordHash,
      name: "Administrateur",
    },
  })

  console.log("\n✓ Compte administrateur créé :")
  console.log("  Email    :", user.email)
  console.log("  Password : admin123")
  console.log("\n→ Connectez-vous sur http://localhost:3000/login\n")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
