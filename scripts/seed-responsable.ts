import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"

function getDbPath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db"
  const p = url.replace(/^file:/, "")
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)
}

const adapter = new PrismaBetterSqlite3({ url: getDbPath() })
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

async function main() {
  const email    = "responsable@monrh.fr"
  const password = "responsable123"
  const hash     = await bcrypt.hash(password, 12)

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: "RESPONSABLE", passwordHash: hash } })
    console.log("Compte RESPONSABLE mis à jour :", email)
  } else {
    await prisma.user.create({
      data: { email, passwordHash: hash, name: "M. Dupont (Responsable)", role: "RESPONSABLE" },
    })
    console.log("Compte RESPONSABLE créé :", email)
  }

  // S'assurer que l'admin est RH
  await prisma.user.updateMany({ where: { email: "admin@monrh.fr" }, data: { role: "RH" } })
  console.log("Rôle RH confirmé pour admin@monrh.fr")

  console.log("\n────────────────────────────────")
  console.log("Comptes disponibles :")
  console.log("  RH          → admin@monrh.fr       / admin123")
  console.log("  RESPONSABLE → responsable@monrh.fr  / responsable123")
  console.log("────────────────────────────────")
}

main().catch(console.error).finally(() => prisma.$disconnect())
