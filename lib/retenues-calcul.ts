// Fonctions de calcul pures — sans dépendance serveur, importables côté client
const JOURS_OUVRES_MOIS = 26
const HEURES_MOIS = 208

export function calculerRetenueAbsence(joursAbsence: number, salaireBase: number): number {
  return Math.round((salaireBase / JOURS_OUVRES_MOIS) * joursAbsence)
}

export function calculerRetenueRetard(minutesRetard: number, salaireBase: number): number {
  const heuresRetard = minutesRetard / 60
  const tauxHoraire  = salaireBase / HEURES_MOIS
  return Math.round(heuresRetard * tauxHoraire * 2)
}
