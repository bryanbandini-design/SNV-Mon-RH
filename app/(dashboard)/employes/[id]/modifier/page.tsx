"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Loader2, FlaskConical, Trash2, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { TYPES_CONTRAT, TYPES_CONTRAT_LABELS, STATUTS_EMPLOYE, ROLES_ORG, ROLES_ORG_LABELS } from "@/lib/utils"
import { toast } from "sonner"

export default function ModifierEmployePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [periodeEssai, setPeriodeEssai] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [employes, setEmployes] = useState<{ id: string; prenom: string; nom: string; poste: string }[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/employes/${id}`).then(r => r.json()),
      fetch("/api/employes").then(r => r.json()),
    ]).then(([emp, allEmps]) => {
      setForm({
        prenom:         emp.prenom          ?? "",
        nom:            emp.nom             ?? "",
        email:          emp.email           ?? "",
        telephone:      emp.telephone       ?? "",
        dateNaissance:  emp.dateNaissance   ? emp.dateNaissance.split("T")[0]  : "",
        lieuNaissance:  emp.lieuNaissance   ?? "",
        adresse:        emp.adresse         ?? "",
        nationalite:    emp.nationalite     ?? "",
        numeroCni:      emp.numeroCni       ?? "",
        matricule:      emp.matricule       ?? "",
        poste:          emp.poste           ?? "",
        departement:    emp.departement     ?? "",
        typeContrat:    emp.typeContrat     ?? "",
        roleOrg:        emp.roleOrg         ?? "EMPLOYE",
        statut:         emp.statut          ?? "ACTIF",
        dateEmbauche:   emp.dateEmbauche    ? emp.dateEmbauche.split("T")[0]   : "",
        dateFinContrat: emp.dateFinContrat  ? emp.dateFinContrat.split("T")[0] : "",
        salaireBase:    String(emp.salaireBase ?? ""),
        managerId:      emp.managerId       ?? "",
        dateDebutEssai: emp.dateDebutEssai  ? emp.dateDebutEssai.split("T")[0] : "",
        dateFinEssai:   emp.dateFinEssai    ? emp.dateFinEssai.split("T")[0]   : "",
        notes:          emp.notes           ?? "",
        jourRepos:      emp.jourRepos       ?? "",
      })
      setPeriodeEssai(emp.periodeEssai ?? false)
      if (Array.isArray(allEmps)) setEmployes(allEmps.filter((e: { id: string }) => e.id !== id))
    }).finally(() => setLoading(false))
  }, [id])

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/employes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, periodeEssai }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success("Fiche employé mise à jour")
      router.push(`/employes/${id}`)
    } else {
      toast.error("Erreur lors de la mise à jour")
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer définitivement cet employé ? Cette action est irréversible.")) return
    await fetch(`/api/employes/${id}`, { method: "DELETE" })
    toast.success("Employé supprimé")
    router.push("/employes")
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href={`/employes/${id}`}>
            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Modifier l&apos;employé</h1>
            <p className="text-slate-500 mt-0.5 text-sm">{form.prenom} {form.nom}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 border-red-200 hover:bg-red-50">
          <Trash2 className="h-4 w-4" /> Supprimer
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Informations personnelles ── */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Informations personnelles</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Prénom *</Label><Input value={form.prenom ?? ""} onChange={e => set("prenom", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Nom *</Label><Input value={form.nom ?? ""} onChange={e => set("nom", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} /></div>
            <div className="space-y-2"><Label>Téléphone</Label><Input value={form.telephone ?? ""} onChange={e => set("telephone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Date de naissance</Label><Input type="date" value={form.dateNaissance ?? ""} onChange={e => set("dateNaissance", e.target.value)} /></div>
            <div className="space-y-2"><Label>Lieu de naissance</Label><Input value={form.lieuNaissance ?? ""} onChange={e => set("lieuNaissance", e.target.value)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Adresse</Label><Input value={form.adresse ?? ""} onChange={e => set("adresse", e.target.value)} /></div>
            <div className="space-y-2"><Label>Nationalité</Label><Input value={form.nationalite ?? ""} onChange={e => set("nationalite", e.target.value)} /></div>
            <div className="space-y-2"><Label>CNI / Passeport</Label><Input value={form.numeroCni ?? ""} onChange={e => set("numeroCni", e.target.value)} /></div>
          </CardContent>
        </Card>

        {/* ── Informations professionnelles ── */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Informations professionnelles</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Matricule *</Label>
              <Input value={form.matricule ?? ""} onChange={e => set("matricule", e.target.value)} required className="font-mono" />
            </div>
            <div className="space-y-2"><Label>Poste *</Label><Input value={form.poste ?? ""} onChange={e => set("poste", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Département</Label><Input value={form.departement ?? ""} onChange={e => set("departement", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Type de contrat *</Label>
              <Select value={form.typeContrat ?? ""} onValueChange={v => set("typeContrat", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES_CONTRAT.map(t => <SelectItem key={t} value={t}>{TYPES_CONTRAT_LABELS[t] ?? t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Niveau de responsabilité</Label>
              <Select value={form.roleOrg ?? "EMPLOYE"} onValueChange={v => set("roleOrg", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES_ORG.map(r => <SelectItem key={r} value={r}>{ROLES_ORG_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={form.statut ?? "ACTIF"} onValueChange={v => set("statut", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUTS_EMPLOYE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jour de repos hebdomadaire</Label>
              <Select value={form.jourRepos ?? ""} onValueChange={v => set("jourRepos", v)}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIMANCHE">Dimanche (travail lun–sam)</SelectItem>
                  <SelectItem value="SAMEDI">Samedi (travail lun–ven + dim)</SelectItem>
                  <SelectItem value="">Semaine 5 jours (lun–ven)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Date d&apos;embauche *</Label><Input type="date" value={form.dateEmbauche ?? ""} onChange={e => set("dateEmbauche", e.target.value)} required /></div>
            <div className="space-y-2"><Label>Fin de contrat</Label><Input type="date" value={form.dateFinContrat ?? ""} onChange={e => set("dateFinContrat", e.target.value)} /></div>
            <div className="space-y-2"><Label>Salaire de base *</Label><Input type="number" value={form.salaireBase ?? ""} onChange={e => set("salaireBase", e.target.value)} required /></div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Supérieur direct</Label>
              <select value={form.managerId ?? ""} onChange={e => set("managerId", e.target.value)}
                className="w-full h-9 text-sm border border-input rounded-md px-3 bg-background focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">— Aucun (racine de l&apos;organigramme)</option>
                {employes.map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste}</option>)}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} rows={3} /></div>
          </CardContent>
        </Card>

        {/* ── Période d'essai ── */}
        <Card className={periodeEssai ? "border-orange-200 bg-orange-50/30" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-orange-500" />
                Période d&apos;essai
              </CardTitle>
              <div onClick={() => setPeriodeEssai(!periodeEssai)}
                className={`relative w-10 h-5 rounded-full cursor-pointer transition-colors ${periodeEssai ? "bg-orange-500" : "bg-slate-300"}`}>
                <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${periodeEssai ? "translate-x-5" : ""}`} />
              </div>
            </div>
          </CardHeader>
          {periodeEssai && (
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Début essai</Label><Input type="date" value={form.dateDebutEssai ?? ""} onChange={e => set("dateDebutEssai", e.target.value)} /></div>
              <div className="space-y-2"><Label>Fin essai</Label><Input type="date" value={form.dateFinEssai ?? ""} onChange={e => set("dateFinEssai", e.target.value)} /></div>
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Link href={`/employes/${id}`}><Button variant="outline" type="button">Annuler</Button></Link>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer les modifications
          </Button>
        </div>
      </form>
    </div>
  )
}
