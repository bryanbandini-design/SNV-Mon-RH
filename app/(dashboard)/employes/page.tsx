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
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Employés</h1>
          <p className="text-slate-500 mt-1 text-sm">{employes.filter(e => e.statut === "ACTIF").length} actif(s) · {employes.length} au total</p>
        </div>
        <Link href="/employes/nouveau">
          <Button className="shadow-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouvel employé</span>
            <span className="sm:hidden">Nouveau</span>
          </Button>
        </Link>
      </div>

      <EmployeesClient employes={employes} />
    </div>
  )
}
