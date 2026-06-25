/**
 * Moteur de calcul de paie — Droit camerounais
 * Sources : CNPS, DGI Cameroun, Code du Travail camerounais
 */

export const CAMEROUN = {
  // CNPS - Caisse Nationale de Prévoyance Sociale
  CNPS_PLAFOND_MENSUEL:   750_000,   // FCFA — plafond de cotisation mensuel
  CNPS_VIEILLESSE_SAL:    0.042,     // 4.2% salarié (Vieillesse-Invalidité-Décès)
  CNPS_VIEILLESSE_PAT:    0.037,     // 3.7% patronal
  CNPS_ALLOC_FAM_PAT:     0.070,     // 7.0% patronal — Allocations Familiales
  CNPS_AT_MP_PAT:         0.025,     // 2.5% patronal — Accidents du Travail (taux moyen)

  // IRPP — barème mensuel (Loi de finances — tranches annuelles divisées par 12)
  IRPP_TRANCHES: [
    { min: 0,       max: 166_667,  taux: 0.10 },
    { min: 166_668, max: 250_000,  taux: 0.15 },
    { min: 250_001, max: 416_667,  taux: 0.25 },
    { min: 416_668, max: Infinity, taux: 0.35 },
  ],

  // Abattement forfaitaire : 30% du revenu net imposable, plafonné à 25 000 FCFA/mois
  IRPP_ABATTEMENT_TAUX:   0.30,
  IRPP_ABATTEMENT_PLAFOND: 25_000,

  // CAC — Centimes Additionnels Communaux
  CAC_TAUX: 0.10,  // 10% de l'IRPP

  // RAV — Redevance Audiovisuelle Mensuelle
  RAV_MENSUEL: 625,

  // SMIG 2024
  SMIG: 41_875,
}

export type DetailsSalaire = {
  brutImposable: number    // Salaire de base + Primes
  cnpsSalarie:   number    // 4.2% du brut plafonné
  revenuNetImposable: number
  abattement:    number
  baseIRPP:      number
  irpp:          number
  cac:           number
  rav:           number
  autresRetenues: number   // avances, absences, saisies manuelles
  totalRetenues: number
  netAPayer:     number
  // Informatif employeur
  cnpsPatronal:  number
  coutTotal:     number    // brut + charges patronales
}

/**
 * Calcule toutes les cotisations et le net à payer selon la loi camerounaise.
 * @param salaireBase   Salaire de base mensuel brut (FCFA)
 * @param primes        Total des primes imposables du mois
 * @param autresRetenues Retenues diverses (avances, absences…) — non soumises aux cotisations
 */
export function calculerSalaire(
  salaireBase: number,
  primes:      number,
  autresRetenues: number
): DetailsSalaire {
  const brut = Math.round(salaireBase + primes)

  // ── CNPS salarié ────────────────────────────────────────────────────
  const baseCNPS    = Math.min(brut, CAMEROUN.CNPS_PLAFOND_MENSUEL)
  const cnpsSalarie = Math.round(baseCNPS * CAMEROUN.CNPS_VIEILLESSE_SAL)

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

  // ── CAC ─────────────────────────────────────────────────────────────
  const cac = Math.round(irpp * CAMEROUN.CAC_TAUX)

  // ── RAV ─────────────────────────────────────────────────────────────
  const rav = CAMEROUN.RAV_MENSUEL

  // ── Charges patronales (informatif) ─────────────────────────────────
  const cnpsPatronal = Math.round(
    baseCNPS * (CAMEROUN.CNPS_VIEILLESSE_PAT + CAMEROUN.CNPS_ALLOC_FAM_PAT + CAMEROUN.CNPS_AT_MP_PAT)
  )

  // ── Total retenues salariales ────────────────────────────────────────
  const totalRetenues = cnpsSalarie + irpp + cac + rav + Math.round(autresRetenues)

  // ── Net ─────────────────────────────────────────────────────────────
  const netAPayer = Math.max(0, brut - totalRetenues)

  return {
    brutImposable: brut,
    cnpsSalarie,
    revenuNetImposable,
    abattement,
    baseIRPP,
    irpp,
    cac,
    rav,
    autresRetenues: Math.round(autresRetenues),
    totalRetenues,
    netAPayer,
    cnpsPatronal,
    coutTotal: brut + cnpsPatronal,
  }
}

export function formatFCFA(n: number): string {
  return n.toLocaleString("fr-FR") + " FCFA"
}
