"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Loader2, FlaskConical } from "lucide-react"
import Link from "next/link"
import { TYPES_CONTRAT } from "@/lib/utils"
import { toast } from "sonner"

export default function NouvelEmployePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [periodeEssai, setPeriodeEssai] = useState(false)
  const [typeContrat, setTypeContrat] = useState("")
  const [dateEmbauche, setDateEmbauche] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const data = Object.fromEntries(form.entries())
    data.periodeEssai = periodeEssai ? "true" : "false"

    const res = await fetch("/api/employes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    setLoading(false)

    if (res.ok) {
      toast.success("Employé créé avec succès")
      router.push("/employes")
      router.refresh()
    } else {
      const err = await res.json()
      toast.error(err.message ?? "Erreur lors de la création")
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/employes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouvel employé</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Créer la fiche d&apos;un nouvel employé</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Informations personnelles</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Prénom *</Label><Input name="prenom" required /></div>
            <div className="space-y-2"><Label>Nom *</Label><Input name="nom" required /></div>
            <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" /></div>
            <div className="space-y-2"><Label>Téléphone</Label><Input name="telephone" /></div>
            <div className="space-y-2"><Label>Date de naissance</Label><Input name="dateNaissance" type="date" /></div>
            <div className="space-y-2"><Label>Lieu de naissance</Label><Input name="lieuNaissance" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Adresse</Label><Input name="adresse" /></div>
            <div className="space-y-2"><Label>Nationalité</Label><Input name="nationalite" /></div>
            <div className="space-y-2"><Label>CNI / Passeport</Label><Input name="numeroCni" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Informations professionnelles</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Matricule *</Label><Input name="matricule" placeholder="EMP-001" required /></div>
            <div className="space-y-2"><Label>Poste *</Label><Input name="poste" required /></div>
            <div className="space-y-2"><Label>Département</Label><Input name="departement" /></div>
            <div className="space-y-2">
              <Label>Type de contrat *</Label>
              <Select name="typeContrat" required onValueChange={setTypeContrat}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{TYPES_CONTRAT.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date d&apos;embauche *</Label>
              <Input name="dateEmbauche" type="date" required value={dateEmbauche} onChange={e => setDateEmbauche(e.target.value)} />
            </div>
            <div className="space-y-2"><Label>Fin de contrat</Label><Input name="dateFinContrat" type="date" /></div>
            <div className="space-y-2"><Label>Salaire de base *</Label><Input name="salaireBase" type="number" min="0" step="1000" required /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea name="notes" rows={3} /></div>
          </CardContent>
        </Card>

        <Card className={periodeEssai ? "border-orange-200 bg-orange-50/30" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-orange-500" />
                Période d&apos;essai
              </CardTitle>
              <div onClick={() => setPeriodeEssai(!periodeEssai)} className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors ${periodeEssai ? "bg-orange-500" : "bg-slate-300"}`}>
                <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${periodeEssai ? "translate-x-5" : ""}`} />
              </div>
            </div>
          </CardHeader>
          {periodeEssai && (
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Début de la période d&apos;essai</Label>
                <Input name="dateDebutEssai" type="date" defaultValue={dateEmbauche} required={periodeEssai} />
              </div>
              <div className="space-y-2">
                <Label>Fin de la période d&apos;essai</Label>
                <Input name="dateFinEssai" type="date" required={periodeEssai} />
              </div>
              <p className="sm:col-span-2 text-xs text-orange-700 bg-orange-50 rounded-md px-3 py-2">
                Un badge &ldquo;Période d&apos;essai&rdquo; sera visible sur la fiche jusqu&apos;à la date de fin.
              </p>
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/employes"><Button variant="outline" type="button">Annuler</Button></Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Créer l&apos;employé
          </Button>
        </div>
      </form>
    </div>
  )
}
