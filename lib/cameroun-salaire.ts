/**
 * Moteur de calcul de paie — Droit camerounais
 * Sources : CNPS, DGI Cameroun, Code du Travail camerounais
 */

export const CAMEROUN = {
  // Durée légale hebdomadaire (Code du Travail, art. 80)
  HEURES_LEGALES_SEMAINE: 40,
  // Taux HS (multiplicateurs du taux horaire brut)
  HS_TAUX_NORMAL:   1.20,   // +20% — 8 premières heures sup/semaine
  HS_TAUX_ELEVE:    1.50,   // +50% — heures sup au-delà de 8h/semaine
  HS_TAUX_DIMANCHE: 1.75,   // +75% — dimanches et jours fériés

  // CNPS — Caisse Nationale de Prévoyance Sociale
  CNPS_PLAFOND_MENSUEL:  750_000,  // FCFA — plafond de cotisation mensuel
  CNPS_VIEILLESSE_SAL:   0.042,    // 4.2% salarié (Vieillesse-Invalidité-Décès)
  CNPS_PATRONAL_TOTAL:   0.1295,   // 12.95% patronal (taux global)

  // CCF — Contribution au Crédit Foncier
  CCF_SALARIAL:  0.01,   // 1.0% salarié
  CCF_PATRONAL:  0.015,  // 1.5% patronal

  // FNE — Fonds National de l'Emploi
  FNE_PATRONAL:  0.01,   // 1.0% patronal

  // IRPP — barème mensuel (tranches annuelles DGI divisées par 12)
  IRPP_TRANCHES: [
    { min: 0,       max: 166_667,  taux: 0.10 },
    { min: 166_668, max: 250_000,  taux: 0.15 },
    { min: 250_001, max: 416_667,  taux: 0.25 },
    { min: 416_668, max: Infinity, taux: 0.35 },
  ],
  // Abattement forfaitaire : 30% du revenu net imposable, plafonné à 25 000 FCFA/mois
  IRPP_ABATTEMENT_TAUX:    0.30,
  IRPP_ABATTEMENT_PLAFOND: 25_000,

  // CAC — Centimes Additionnels Communaux
  CAC_TAUX: 0.10,  // 10% de l'IRPP

  // SMIG 2024
  SMIG: 41_875,
}

// ── Barème RAV mensuel (Annexe V) — basé sur salaire brut taxable mensuel ──
function calculerRAV(brutMensuel: number): number {
  if (brutMensuel <=    62_000) return 0
  if (brutMensuel <=   100_000) return 750
  if (brutMensuel <=   200_000) return 1_950
  if (brutMensuel <=   300_000) return 3_250
  if (brutMensuel <=   400_000) return 4_550
  if (brutMensuel <=   500_000) return 5_850
  if (brutMensuel <=   600_000) return 7_150
  if (brutMensuel <=   700_000) return 8_450
  if (brutMensuel <=   800_000) return 9_750
  if (brutMensuel <=   900_000) return 11_050
  if (brutMensuel <= 1_000_000) return 12_350
  return 13_000
}

// ── Barème TDL mensuel (Annexe VI) — basé sur salaire de BASE mensuel ────
// Montants annuels du barème divisés par 12
function calculerTDL(salaireBase: number): number {
  if (salaireBase <    62_000) return 0
  if (salaireBase <=   75_000) return 250    // 3 000/an
  if (salaireBase <=  100_000) return 500    // 6 000/an
  if (salaireBase <=  125_000) return 750    // 9 000/an
  if (salaireBase <=  150_000) return 1_000  // 12 000/an
  if (salaireBase <=  200_000) return 1_250  // 15 000/an
  if (salaireBase <=  250_000) return 1_500  // 18 000/an
  if (salaireBase <=  300_000) return 2_000  // 24 000/an
  if (salaireBase <=  500_000) return 2_250  // 27 000/an
  return 2_500                               // 30 000/an
}

export type TauxHS = "NORMAL" | "ELEVE" | "DIMANCHE"

/**
 * Calcule le montant brut des heures supplémentaires.
 */
export function calculerHS(salaireBase: number, nbHeures: number, taux: TauxHS = "NORMAL"): number {
  const tauxHoraire = salaireBase / (CAMEROUN.HEURES_LEGALES_SEMAINE * 4.33)
  const multiplicateur =
    taux === "DIMANCHE" ? CAMEROUN.HS_TAUX_DIMANCHE :
    taux === "ELEVE"    ? CAMEROUN.HS_TAUX_ELEVE    :
                          CAMEROUN.HS_TAUX_NORMAL
  return Math.round(tauxHoraire * nbHeures * multiplicateur)
}

export type DetailsSalaire = {
  brutImposable:      number   // Base + Primes + HS
  montantHS:          number   // montant brut des heures sup
  // ── Cotisations salariales ──
  cnpsSalarie:        number   // 4.2% du brut plafonné à 750 000
  ccfSalarie:         number   // 1.0% du brut
  revenuNetImposable: number   // brut − CNPS salarié
  abattement:         number   // 30% RNI, max 25 000/mois
  baseIRPP:           number   // RNI − abattement
  irpp:               number   // IRPP progressif
  cac:                number   // 10% de l'IRPP
  rav:                number   // Barème RAV mensuel (Annexe V)
  tdl:                number   // Barème TDL mensuel (Annexe VI, base/12)
  autresRetenues:     number   // avances, absences, saisies manuelles
  totalRetenues:      number   // total retenues salariales
  netAPayer:          number
  // ── Charges patronales (informatif, non déduites du salaire) ──
  cnpsPatronal:       number   // 12.95% du brut plafonné
  ccfPatronal:        number   // 1.5% du brut
  fne:                number   // 1.0% du brut (FNE patronal)
  coutTotal:          number   // brut + toutes charges patronales
}

/**
 * Calcule toutes les cotisations et le net à payer selon la loi camerounaise.
 * @param salaireBase    Salaire de base mensuel brut (FCFA) — utilisé pour le barème TDL
 * @param primes         Total des primes imposables du mois
 * @param autresRetenues Retenues diverses (avances, absences…) — non soumises aux cotisations
 * @param montantHS      Montant brut des heures supplémentaires (pré-calculé via calculerHS)
 */
export function calculerSalaire(
  salaireBase:     number,
  primes:          number,
  autresRetenues:  number,
  montantHS:       number = 0,
): DetailsSalaire {
  const brut = Math.round(salaireBase + primes + montantHS)

  // ── CNPS salarié (4.2%, plafonné à 750 000) ──────────────────────────
  const baseCNPS    = Math.min(brut, CAMEROUN.CNPS_PLAFOND_MENSUEL)
  const cnpsSalarie = Math.round(baseCNPS * CAMEROUN.CNPS_VIEILLESSE_SAL)

  // ── CCF salarié (1% du brut) ─────────────────────────────────────────
  const ccfSalarie = Math.round(brut * CAMEROUN.CCF_SALARIAL)

  // ── Base IRPP ────────────────────────────────────────────────────────
  const revenuNetImposable = Math.max(0, brut - cnpsSalarie)
  const abattementRaw      = Math.round(revenuNetImposable * CAMEROUN.IRPP_ABATTEMENT_TAUX)
  const abattement         = Math.min(abattementRaw, CAMEROUN.IRPP_ABATTEMENT_PLAFOND)
  const baseIRPP           = Math.max(0, revenuNetImposable - abattement)

  // ── IRPP progressif ──────────────────────────────────────────────────
  let irppBrut = 0
  for (const t of CAMEROUN.IRPP_TRANCHES) {
    if (baseIRPP <= t.min) break
    const imposable = Math.min(baseIRPP, t.max) - t.min
    irppBrut += imposable * t.taux
  }
  const irpp = Math.round(irppBrut)

  // ── CAC (10% de l'IRPP) ─────────────────────────────────────────────
  const cac = Math.round(irpp * CAMEROUN.CAC_TAUX)

  // ── RAV — barème Annexe V (sur brut mensuel taxable) ────────────────
  const rav = calculerRAV(brut)

  // ── TDL — barème Annexe VI / 12 (sur salaire de BASE) ───────────────
  const tdl = calculerTDL(salaireBase)

  // ── Charges patronales (informatif) ─────────────────────────────────
  const cnpsPatronal = Math.round(baseCNPS * CAMEROUN.CNPS_PATRONAL_TOTAL)
  const ccfPatronal  = Math.round(brut * CAMEROUN.CCF_PATRONAL)
  const fne          = Math.round(brut * CAMEROUN.FNE_PATRONAL)

  // ── Total retenues salariales ────────────────────────────────────────
  const totalRetenues = cnpsSalarie + ccfSalarie + irpp + cac + rav + tdl + Math.round(autresRetenues)

  // ── Net ─────────────────────────────────────────────────────────────
  const netAPayer = Math.max(0, brut - totalRetenues)

  return {
    brutImposable: brut,
    montantHS:     Math.round(montantHS),
    cnpsSalarie,
    ccfSalarie,
    revenuNetImposable,
    abattement,
    baseIRPP,
    irpp,
    cac,
    rav,
    tdl,
    autresRetenues: Math.round(autresRetenues),
    totalRetenues,
    netAPayer,
    cnpsPatronal,
    ccfPatronal,
    fne,
    coutTotal: brut + cnpsPatronal + ccfPatronal + fne,
  }
}

export function formatFCFA(n: number): string {
  return n.toLocaleString("fr-FR") + " FCFA"
}
