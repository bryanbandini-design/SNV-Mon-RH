/**
 * ZKTeco ADMS — /iclock/getrequest
 * Le terminal appelle ce endpoint toutes les X secondes pour recevoir des commandes.
 * Pour l'instant on répond simplement "OK" (pas de commandes à envoyer).
 */
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sn = searchParams.get("SN")

  if (sn) {
    // Mettre à jour le lastSyncAt du device si connu
    await prisma.zktecoDevice.updateMany({
      where: { serialNumber: sn },
      data:  { lastSyncAt: new Date() },
    }).catch(() => {})  // Ignorer si le device n'est pas encore enregistré
  }

  return new Response("OK", { headers: { "Content-Type": "text/plain" } })
}
