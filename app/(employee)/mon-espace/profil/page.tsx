import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"

export default async function MonProfilPage() {
  const session = await auth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeId = (session?.user as any)?.employeId as string | null
  if (!employeId) redirect("/login")

  const employe = await prisma.employe.findUnique({ where: { id: employeId } })
  if (!employe) redirect("/login")

  const sections = [
    {
      title: "Informations personnelles",
      rows: [
        { label: "Prénom",            value: employe.prenom                  },
        { label: "Nom",               value: employe.nom                     },
        { label: "Email",             value: employe.email                   },
        { label: "Téléphone",         value: employe.telephone               },
        { label: "Date de naissance", value: employe.dateNaissance ? formatDate(employe.dateNaissance) : null },
        { label: "Lieu de naissance", value: employe.lieuNaissance           },
        { label: "Adresse",           value: employe.adresse                 },
        { label: "Nationalité",       value: employe.nationalite             },
        { label: "N° CNI / Passeport",value: employe.numeroCni               },
      ].filter(r => r.value),
    },
    {
      title: "Informations professionnelles",
      rows: [
        { label: "Matricule",       value: employe.matricule                 },
        { label: "Poste",           value: employe.poste                     },
        { label: "Département",     value: employe.departement               },
        { label: "Type de contrat", value: employe.typeContrat               },
        { label: "Date d'embauche", value: formatDate(employe.dateEmbauche)  },
        { label: "Fin de contrat",  value: employe.dateFinContrat ? formatDate(employe.dateFinContrat) : "Indéterminé" },
        { label: "Salaire de base", value: formatCurrency(employe.salaireBase) },
        { label: "Statut",          value: employe.statut                    },
      ].filter(r => r.value),
    },
  ]

  if (employe.periodeEssai && employe.dateFinEssai) {
    const now = new Date()
    const fin = new Date(employe.dateFinEssai)
    sections.push({
      title: "Période d'essai",
      rows: [
        { label: "Début",  value: employe.dateDebutEssai ? formatDate(employe.dateDebutEssai) : "—" },
        { label: "Fin",    value: formatDate(employe.dateFinEssai) },
        { label: "Statut", value: now < fin ? `En cours (${Math.ceil((fin.getTime() - now.getTime()) / 86400000)} j restants)` : "Terminée" },
      ],
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mon profil</h1>
        <p className="text-sm text-slate-500 mt-1">Vos informations personnelles et professionnelles</p>
      </div>

      {/* Avatar hero */}
      <div className="rounded-2xl p-6 flex items-center gap-5"
        style={{ background: "linear-gradient(135deg, #064e3b, #065f46)" }}>
        <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
          {employe.prenom[0]}{employe.nom[0]}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{employe.prenom} {employe.nom}</h2>
          <p className="text-emerald-200 text-sm">{employe.poste}{employe.departement ? ` · ${employe.departement}` : ""}</p>
          <p className="text-emerald-300 text-xs mt-0.5">Matricule {employe.matricule}</p>
        </div>
      </div>

      {sections.map(section => (
        <div key={section.title} className="rounded-xl border border-slate-200 bg-white">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">{section.title}</p>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {section.rows.map(row => (
              <div key={row.label}>
                <p className="text-xs text-slate-400 mb-0.5">{row.label}</p>
                <p className="text-sm font-medium text-slate-800">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-400 text-center">Pour modifier vos informations, contactez votre service RH.</p>
    </div>
  )
}
