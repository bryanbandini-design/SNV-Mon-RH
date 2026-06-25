// Définition centralisée des modules et permissions

export type PermKey =
  | "DASHBOARD" | "EMPLOYES" | "CONGES" | "DISCIPLINAIRE" | "SALAIRES"
  | "EVALUATIONS" | "HORAIRES" | "POINTAGE" | "HISTORIQUE"
  | "RECRUTEMENT" | "FORMATIONS" | "ORGANIGRAMME"
  | "PARAMETRES" | "ADMIN_USERS"

export const ALL_PERMISSIONS: PermKey[] = [
  "DASHBOARD", "EMPLOYES", "CONGES", "DISCIPLINAIRE", "SALAIRES",
  "EVALUATIONS", "HORAIRES", "POINTAGE", "HISTORIQUE",
  "RECRUTEMENT", "FORMATIONS", "ORGANIGRAMME",
  "PARAMETRES", "ADMIN_USERS",
]

export const PERM_LABELS: Record<PermKey, string> = {
  DASHBOARD:    "Tableau de bord",
  EMPLOYES:     "Employés",
  CONGES:       "Congés & Absences",
  DISCIPLINAIRE:"Disciplinaire",
  SALAIRES:     "Salaires",
  EVALUATIONS:  "Évaluations",
  HORAIRES:     "Horaires & Planning",
  POINTAGE:     "Pointage QR",
  HISTORIQUE:   "Historique & Audit",
  RECRUTEMENT:  "Recrutement",
  FORMATIONS:   "Formations",
  ORGANIGRAMME: "Organigramme",
  PARAMETRES:   "Paramètres",
  ADMIN_USERS:  "Gestion utilisateurs",
}

export const PERM_GROUPS = [
  {
    label: "Principal",
    keys: ["DASHBOARD"] as PermKey[],
  },
  {
    label: "Gestion RH",
    keys: ["EMPLOYES", "CONGES", "DISCIPLINAIRE", "SALAIRES"] as PermKey[],
  },
  {
    label: "Performance",
    keys: ["EVALUATIONS", "HORAIRES", "POINTAGE", "HISTORIQUE"] as PermKey[],
  },
  {
    label: "Talent",
    keys: ["RECRUTEMENT", "FORMATIONS", "ORGANIGRAMME"] as PermKey[],
  },
  {
    label: "Administration",
    keys: ["PARAMETRES", "ADMIN_USERS"] as PermKey[],
  },
]

// Permissions par défaut selon le rôle
export const DEFAULT_PERMISSIONS: Record<string, PermKey[]> = {
  ADMIN: ALL_PERMISSIONS,
  RH: [
    "DASHBOARD", "EMPLOYES", "CONGES", "DISCIPLINAIRE", "SALAIRES",
    "EVALUATIONS", "HORAIRES", "POINTAGE", "HISTORIQUE",
    "RECRUTEMENT", "FORMATIONS", "ORGANIGRAMME", "PARAMETRES",
  ],
  RESPONSABLE: [
    "DASHBOARD", "EMPLOYES", "CONGES", "DISCIPLINAIRE", "HORAIRES", "POINTAGE",
  ],
  EMPLOYE: [],
}

export function parsePermissions(raw: string | null | undefined): PermKey[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PermKey[] : []
  } catch {
    return []
  }
}

export function hasPermission(permissions: PermKey[], key: PermKey): boolean {
  return permissions.includes(key)
}
