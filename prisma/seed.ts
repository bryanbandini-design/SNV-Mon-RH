import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10)

  const user = await prisma.user.upsert({
    where: { email: "admin@monrh.com" },
    update: {},
    create: {
      email: "admin@monrh.com",
      passwordHash,
      name: "Administrateur",
      role: "ADMIN",
    },
  })

  console.log("\n✓ Compte administrateur créé :")
  console.log("  Email    :", user.email)
  console.log("  Password : admin123")
  console.log("\n→ Connectez-vous sur http://localhost:3003/login\n")

  const ateliers = [
    { nom: "Atelier A", code: "ATELIER_A", couleur: "#3b82f6" },
    { nom: "Atelier B", code: "ATELIER_B", couleur: "#8b5cf6" },
    { nom: "Bureau RH", code: "BUREAU_RH", couleur: "#10b981" },
    { nom: "Entrepôt",  code: "ENTREPOT",  couleur: "#f59e0b" },
  ]
  for (const a of ateliers) {
    await prisma.atelier.upsert({ where: { code: a.code }, update: {}, create: a })
  }
  console.log("✓ Ateliers créés :", ateliers.map(a => a.nom).join(", "))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
