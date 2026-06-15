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

export const TYPES_CONTRAT = ["CDI", "CDD", "STAGE", "INTERIM", "CONSULTANT"]
export const TYPES_CONGE = ["ANNUEL", "MALADIE", "MATERNITE", "PATERNITE", "SANS_SOLDE", "EXCEPTIONNEL"]
export const TYPES_DISCIPLINAIRE = ["DEMANDE_EXPLICATION", "AVERTISSEMENT", "BLAME", "MISE_EN_DEMEURE", "MISE_A_PIED", "LICENCIEMENT"]
export const STATUTS_EMPLOYE = ["ACTIF", "INACTIF", "SUSPENDU"]

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
