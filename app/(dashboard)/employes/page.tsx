import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Users, FlaskConical } from "lucide-react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { EmployeesClient } from "./client"

export default async function EmployesPage() {
  const employes = await prisma.employe.findMany({
    orderBy: [{ statut: "asc" }, { nom: "asc" }],
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employés</h1>
          <p className="text-slate-500 mt-1">{employes.filter(e => e.statut === "ACTIF").length} actif(s) · {employes.length} au total</p>
        </div>
        <Link href="/employes/nouveau">
          <Button className="shadow-sm">
            <Plus className="h-4 w-4" />
            Nouvel employé
          </Button>
        </Link>
      </div>

      <EmployeesClient employes={employes} />
    </div>
  )
}
