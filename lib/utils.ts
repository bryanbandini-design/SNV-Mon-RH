import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
  }).format(amount)
}

export const TYPES_CONTRAT = ["CDI", "CDD", "STAGE", "INTERIM", "CONSULTANT", "PRESTATAIRE"]
export const TYPES_CONTRAT_LABELS: Record<string, string> = {
  CDI:         "CDI — Contrat à durée indéterminée",
  CDD:         "CDD — Contrat à durée déterminée",
  STAGE:       "Stage",
  INTERIM:     "Intérim",
  CONSULTANT:  "Consultant",
  PRESTATAIRE: "Prestataire de services",
}
export const TYPES_CONGE = ["ANNUEL", "MALADIE", "MATERNITE", "PATERNITE", "SANS_SOLDE", "EXCEPTIONNEL"]
export const TYPES_DISCIPLINAIRE = ["DEMANDE_EXPLICATION", "AVERTISSEMENT", "BLAME", "MISE_EN_DEMEURE", "MISE_A_PIED", "LICENCIEMENT"]
export const STATUTS_EMPLOYE = ["ACTIF", "INACTIF", "SUSPENDU"]

export const ROLES_ORG = ["EMPLOYE", "RESPONSABLE", "RH", "ADMIN"] as const
export const ROLES_ORG_LABELS: Record<string, string> = {
  EMPLOYE:     "Employé",
  RESPONSABLE: "Responsable d'équipe",
  RH:          "Ressources Humaines",
  ADMIN:       "Administrateur",
}

export const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]

export const CRITERES_EVALUATION = [
  { id: "qualite_travail",       label: "Qualité du travail",         description: "Précision, soin, conformité aux standards" },
  { id: "productivite",          label: "Productivité",               description: "Volume et efficacité des tâches réalisées" },
  { id: "ponctualite",           label: "Ponctualité & Assiduité",    description: "Respect des horaires et présence régulière" },
  { id: "communication",         label: "Communication",              description: "Clarté, écoute, expression orale et écrite" },
  { id: "travail_equipe",        label: "Travail d'équipe",           description: "Collaboration, entraide, esprit collectif" },
  { id: "initiative",            label: "Initiative & Autonomie",     description: "Prise de décision, force de proposition" },
  { id: "respect_procedures",    label: "Respect des procédures",     description: "Conformité aux règles, sécurité, protocoles" },
  { id: "developpement",         label: "Développement professionnel", description: "Apprentissage, montée en compétence" },
]

export const NOTES_LABELS: Record<number, string> = {
  1: "Insuffisant",
  2: "À améliorer",
  3: "Satisfaisant",
  4: "Bien",
  5: "Excellent",
}

export function heureEnMinutes(heure: string): number {
  const [h, m] = heure.split(":").map(Number)
  return h * 60 + m
}

export function minutesEnHeure(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m.toString().padStart(2, "0")}`
}

/**
 * Calcule heuresTravaillees, heuresSupBrutes et statutHeuresSup à partir
 * des heures réelles et des bornes de shift de référence.
 *
 * - Arrivée AVANT debutRef  → HS en début (avant prise de service)
 * - Départ  APRÈS finRef    → HS en fin   (dépassement de shift)
 * - heuresTravaillees est capé à la plage [debutRef, finRef] pour le salaire
 */
export function calculerHS(params: {
  heureArrivee:      string
  heureDepart:       string
  heureDebutShiftRef?: string | null
  heureFinShiftRef?:  string | null
}): { heuresTravaillees: number; heuresSupBrutes: number; statutHeuresSup: string } {
  const debut    = heureEnMinutes(params.heureArrivee)
  const fin      = heureEnMinutes(params.heureDepart)
  const debutRef = params.heureDebutShiftRef ? heureEnMinutes(params.heureDebutShiftRef) : null
  const finRef   = params.heureFinShiftRef   ? heureEnMinutes(params.heureFinShiftRef)   : null

  let heuresSupBrutes  = 0
  let statutHeuresSup  = "N/A"

  // HS avant prise de service (arrivée anticipée)
  if (debutRef !== null && debut < debutRef) {
    heuresSupBrutes += (debutRef - debut) / 60
    statutHeuresSup  = "EN_ATTENTE"
  }

  // Point de départ "normal" : début effectif de la plage rémunérée
  const debutEffectif = debutRef !== null ? Math.max(debut, debutRef) : debut

  let heuresTravaillees: number
  if (finRef !== null && fin > finRef) {
    // HS après fin de shift
    heuresTravaillees  = Math.max(0, finRef - debutEffectif) / 60
    heuresSupBrutes   += (fin - finRef) / 60
    statutHeuresSup    = "EN_ATTENTE"
  } else {
    heuresTravaillees  = Math.max(0, fin - debutEffectif) / 60
  }

  return { heuresTravaillees, heuresSupBrutes, statutHeuresSup }
}
