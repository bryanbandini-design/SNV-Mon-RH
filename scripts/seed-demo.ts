/**
 * Seed démo — injecte des données réalistes sur tous les modules
 */
import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"

const adapter = new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") })
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jours(n: number, from = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + n)
  return d
}
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  const resp  = await prisma.user.findFirst({ where: { role: "RESPONSABLE" } })
  if (!admin || !resp) throw new Error("Comptes admin/responsable manquants")

  // ── 1. Employés supplémentaires ───────────────────────────────────────────

  const EMPLOYES_DATA = [
    { matricule:"EMP007", prenom:"Amina",    nom:"Kourouma",  poste:"Infirmière",          departement:"Soins",        typeContrat:"CDI",  salaireBase:420000, dateEmbauche: jours(-900) },
    { matricule:"EMP008", prenom:"Thierno",  nom:"Diallo",    poste:"Agent de sécurité",   departement:"Sécurité",     typeContrat:"CDI",  salaireBase:310000, dateEmbauche: jours(-600) },
    { matricule:"EMP009", prenom:"Kadiatou", nom:"Bah",       poste:"Comptable",           departement:"Finance",      typeContrat:"CDI",  salaireBase:480000, dateEmbauche: jours(-1200) },
    { matricule:"EMP010", prenom:"Ibrahima", nom:"Sow",       poste:"Technicien",          departement:"Maintenance",  typeContrat:"CDD",  salaireBase:280000, dateEmbauche: jours(-180), dateFinContrat: jours(90) },
    { matricule:"EMP011", prenom:"Mariama",  nom:"Camara",    poste:"Assistante RH",       departement:"RH",           typeContrat:"CDI",  salaireBase:350000, dateEmbauche: jours(-450) },
    { matricule:"EMP012", prenom:"Oumar",    nom:"Baldé",     poste:"Chauffeur",           departement:"Logistique",   typeContrat:"CDI",  salaireBase:260000, dateEmbauche: jours(-730) },
    { matricule:"EMP013", prenom:"Fatoumata",nom:"Traoré",    poste:"Secrétaire",          departement:"Administration",typeContrat:"CDI", salaireBase:295000, dateEmbauche: jours(-360) },
    { matricule:"EMP014", prenom:"Mamadou",  nom:"Condé",     poste:"Responsable dépôt",   departement:"Logistique",   typeContrat:"CDI",  salaireBase:390000, dateEmbauche: jours(-820), periodeEssai: false },
  ]

  const employes: Array<{id:string; prenom:string; nom:string; matricule:string; salaireBase:number}> = []
  for (const e of EMPLOYES_DATA) {
    const existing = await prisma.employe.findUnique({ where: { matricule: e.matricule } })
    if (!existing) {
      const created = await prisma.employe.create({ data: e })
      employes.push(created)
      console.log(`  + Employé : ${e.prenom} ${e.nom}`)
    } else {
      employes.push(existing)
    }
  }

  // Récupérer TOUS les employés
  const allEmps = await prisma.employe.findMany()
  console.log(`\n  Total employés : ${allEmps.length}`)

  // ── 2. Congés ─────────────────────────────────────────────────────────────

  const TYPES_CONGE = ["ANNUEL", "MALADIE", "MATERNITE", "SANS_SOLDE", "EXCEPTIONNEL"]
  const STATUTS_CONGE = ["APPROUVE", "APPROUVE", "APPROUVE", "REFUSE", "EN_ATTENTE"]

  for (const emp of allEmps.slice(0, 6)) {
    const nbConges = await prisma.conge.count({ where: { employeId: emp.id } })
    if (nbConges < 2) {
      const debut = jours(-randInt(30, 90))
      const nb    = randInt(2, 14)
      await prisma.conge.create({
        data: {
          employeId: emp.id,
          type:      rand(TYPES_CONGE),
          dateDebut: debut,
          dateFin:   jours(nb, debut),
          nbJours:   nb,
          motif:     rand(["Repos annuel", "Raisons médicales", "Événement familial", "Vacances"]),
          statut:    rand(STATUTS_CONGE),
        },
      })
    }
  }

  // Quelques congés en attente
  for (const emp of allEmps.slice(0, 3)) {
    const debut = jours(randInt(7, 21))
    const nb    = randInt(3, 10)
    await prisma.conge.create({
      data: {
        employeId: emp.id,
        type:      "ANNUEL",
        dateDebut: debut,
        dateFin:   jours(nb, debut),
        nbJours:   nb,
        motif:     "Congé annuel planifié",
        statut:    "EN_ATTENTE",
      },
    })
  }
  console.log("  + Congés injectés")

  // ── 3. Salaires ───────────────────────────────────────────────────────────

  const MOIS_PAYE = [1,2,3,4,5]
  for (const emp of allEmps) {
    const existingSals = await prisma.historiqueSalaire.count({ where: { employeId: emp.id } })
    if (existingSals < 3) {
      for (const mois of MOIS_PAYE) {
        const primes   = rand([0, 0, 25000, 50000, 30000])
        const retenues = rand([0, 15000, 20000, 0])
        const net      = emp.salaireBase + primes - retenues
        const deja = await prisma.historiqueSalaire.findFirst({ where: { employeId: emp.id, mois, annee: 2026 } })
        if (!deja) {
          await prisma.historiqueSalaire.create({
            data: {
              employeId:   emp.id,
              mois,
              annee:       2026,
              salaireBase: emp.salaireBase,
              primes,
              retenues,
              netAPayer:   net,
              statut:      mois < 5 ? "PAYE" : rand(["EN_ATTENTE", "PAYE"]),
              datePaiement: mois < 5 ? jours(-(6 - mois) * 30) : null,
            },
          })
        }
      }
    }
  }
  console.log("  + Salaires injectés")

  // ── 4. Évaluations ────────────────────────────────────────────────────────

  const CRITERES = ["qualite_travail","productivite","ponctualite","communication","travail_equipe","initiative"]
  for (const emp of allEmps.slice(0, 5)) {
    const existing = await prisma.evaluation.findFirst({ where: { employeId: emp.id } })
    if (!existing) {
      const notes = CRITERES.map(c => ({ critere: c, note: randInt(2, 5) }))
      const score = notes.reduce((s, n) => s + n.note, 0) / notes.length
      const eval_ = await prisma.evaluation.create({
        data: {
          employeId:   emp.id,
          periode:     "T1 2026",
          dateEval:    jours(-randInt(30, 90)),
          evaluateur:  "Admin RH",
          scoreGlobal: Math.round(score * 10) / 10,
          commentaire: rand([
            "Très bon trimestre, implication remarquée.",
            "Des efforts notables mais des axes d'amélioration subsistent.",
            "Performance satisfaisante dans l'ensemble.",
            "Légère baisse de régime, à surveiller.",
            "Excellent travail d'équipe et grande fiabilité.",
          ]),
          statut: "VALIDE",
        },
      })
      await prisma.noteEvaluation.createMany({
        data: notes.map(n => ({ evaluationId: eval_.id, critere: n.critere, note: n.note })),
      })
    }
  }
  console.log("  + Évaluations injectées")

  // ── 5. Shifts & Présences ─────────────────────────────────────────────────

  let shift1 = await prisma.shift.findFirst({ where: { nom: "Matin" } })
  if (!shift1) {
    shift1 = await prisma.shift.create({ data: { nom: "Matin", heureDebut: "07:00", heureFin: "15:00", couleur: "#3b82f6" } })
    await prisma.shift.create({ data: { nom: "Après-midi", heureDebut: "15:00", heureFin: "23:00", couleur: "#8b5cf6" } })
    await prisma.shift.create({ data: { nom: "Nuit", heureDebut: "23:00", heureFin: "07:00", couleur: "#0f172a" } })
  }

  const STATUTS_PRES = ["PRESENT","PRESENT","PRESENT","RETARD","ABSENT"]
  const today = new Date(); today.setHours(0,0,0,0)

  for (const emp of allEmps.slice(0, 8)) {
    for (let i = 1; i <= 7; i++) {
      const d = jours(-i)
      const existing = await prisma.presence.findFirst({ where: { employeId: emp.id, date: d } })
      if (!existing) {
        const statut  = rand(STATUTS_PRES)
        const retard  = statut === "RETARD" ? randInt(5, 45) : 0
        const heures  = statut === "ABSENT" ? 0 : 8
        await prisma.presence.create({
          data: {
            employeId:        emp.id,
            date:             d,
            heureArrivee:     statut !== "ABSENT" ? (retard > 0 ? `07:${retard.toString().padStart(2,"0")}` : "07:00") : null,
            heureDepart:      statut !== "ABSENT" ? "15:00" : null,
            heuresTravaillees: heures,
            minutesRetard:    retard,
            statut,
          },
        })
      }
    }
  }
  console.log("  + Présences injectées")

  // ── 6. Module disciplinaire — scénarios complets ──────────────────────────

  const emp1 = allEmps.find(e => e.nom === "Sow")    ?? allEmps[0]
  const emp2 = allEmps.find(e => e.nom === "Baldé")  ?? allEmps[1]
  const emp3 = allEmps.find(e => e.nom === "Traoré") ?? allEmps[2]
  const emp4 = allEmps.find(e => e.nom === "Condé")  ?? allEmps[3]
  const emp5 = allEmps.find(e => e.nom === "Diallo") ?? allEmps[4]
  const emp6 = allEmps.find(e => e.nom === "Camara") ?? allEmps[5]

  const existingDossiers = await prisma.dossierDisciplinaire.count()
  if (existingDossiers < 5) {

    // ── Scénario A : Demande d'explication — INITIE (RH doit uploader) ─────
    const dosA = await prisma.dossierDisciplinaire.create({ data: {
      employeId: emp1.id, type: "DEMANDE_EXPLICATION",
      date: jours(-3), motif: "Absences répétées non justifiées",
      description: "M. Sow a été absent sans justificatif les 10, 11 et 12 juin 2026. Aucune information préalable donnée au responsable. Troisième occurrence sur le trimestre.",
      statut: "INITIE", initiePar: resp.id,
      categoriesFaits: "ABSENCE", niveauGravite: "MODERE",
      temoins: "Mme Camara (chef d'équipe)", delaiReponseJours: 5,
    }})
    await prisma.auditLog.create({ data: { dossierId: dosA.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "CREATION", description: "Procédure initiée par M. Dupont (Responsable) — Type : DEMANDE EXPLICATION — Gravité : MODERE", createdAt: jours(-3) }})
    await prisma.notification.create({ data: { userId: admin.id, type: "DEMANDE_INITIE", titre: "Nouvelle demande disciplinaire", message: "M. Dupont a initié une demande d'explication pour Ibrahima Sow (absences répétées).", dossierId: dosA.id, createdAt: jours(-3) }})

    // ── Scénario B : DOCUMENT_PRET (responsable doit transmettre) ──────────
    const dosB = await prisma.dossierDisciplinaire.create({ data: {
      employeId: emp2.id, type: "DEMANDE_EXPLICATION",
      date: jours(-8), motif: "Insubordination envers la hiérarchie",
      description: "M. Baldé a refusé de manière répétée d'exécuter les directives de son supérieur hiérarchique lors de la réunion du 6 juin, en présence de l'équipe.",
      statut: "DOCUMENT_PRET", initiePar: resp.id,
      categoriesFaits: "INSUBORDINATION", niveauGravite: "ELEVE",
      delaiReponseJours: 7, dateEnvoiDocument: jours(-5),
    }})
    await prisma.auditLog.createMany({ data: [
      { dossierId: dosB.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "CREATION", description: "Procédure initiée — Insubordination — Gravité : ELEVE", createdAt: jours(-8) },
      { dossierId: dosB.id, auteurId: admin.id, auteurNom: "Admin RH", type: "DOC_RH", description: "Document officiel de demande d'explication uploadé par Admin RH", createdAt: jours(-5) },
    ]})
    await prisma.notification.create({ data: { userId: resp.id, type: "DOCUMENT_PRET", titre: "Document disponible", message: "Le document pour Oumar Baldé est prêt à être transmis.", dossierId: dosB.id }})

    // ── Scénario C : EN_ATTENTE_REP — délai urgent (2 jours) ───────────────
    const dateEnvC    = jours(-5)
    const dateAttenC  = jours(2)
    const dosC = await prisma.dossierDisciplinaire.create({ data: {
      employeId: emp3.id, type: "DEMANDE_EXPLICATION",
      date: jours(-12), motif: "Retards chroniques — 11 occurrences en 3 mois",
      description: "Mme Traoré accuse un retard chronique depuis le début de l'année. 11 retards constatés de janvier à mars 2026, malgré deux avertissements oraux. Les retards varient de 15 à 90 minutes.",
      statut: "EN_ATTENTE_REP", initiePar: resp.id,
      categoriesFaits: "RETARD", niveauGravite: "MODERE",
      temoins: "M. Baldé, Mme Kourouma",
      delaiReponseJours: 7, dateEnvoiDocument: jours(-8),
      dateEnvoiEmploye: dateEnvC, dateReponseAttendue: dateAttenC,
      modeRemise: "EN_MAIN_PROPRE", dateRemiseEffective: dateEnvC,
      statutReponse: "EN_ATTENTE",
    }})
    await prisma.auditLog.createMany({ data: [
      { dossierId: dosC.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "CREATION", description: "Procédure initiée — Retards chroniques", createdAt: jours(-12) },
      { dossierId: dosC.id, auteurId: admin.id, auteurNom: "Admin RH", type: "DOC_RH", description: "Document officiel uploadé", createdAt: jours(-8) },
      { dossierId: dosC.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "TRANSMISSION", description: "Document transmis à l'employé en main propre — délai : 7 j, échéance " + dateAttenC.toLocaleDateString("fr-FR"), createdAt: dateEnvC },
    ]})
    await prisma.noteInterne.create({ data: { dossierId: dosC.id, auteurId: admin.id, auteurNom: "Admin RH", contenu: "Avertissements oraux précédents : 14/01 et 03/03. Si nouvelle récidive après cette procédure → blâme.", createdAt: jours(-7) }})

    // ── Scénario D : REPONSE_RECUE — dans les délais, à analyser ───────────
    const dateEnvD   = jours(-14)
    const dateAttD   = jours(-7)
    const dateRepD   = jours(-9)  // réponse avant l'échéance ✓
    const dosD = await prisma.dossierDisciplinaire.create({ data: {
      employeId: emp4.id, type: "DEMANDE_EXPLICATION",
      date: jours(-20), motif: "Faute professionnelle — perte de marchandise",
      description: "M. Condé, responsable dépôt, a laissé sortir un lot de marchandises le 25 mai sans bon de livraison signé. La valeur estimée est de 850 000 GNF. Un inventaire différentiel a confirmé la perte.",
      statut: "REPONSE_RECUE", initiePar: resp.id,
      categoriesFaits: "FAUTE_PRO", niveauGravite: "CRITIQUE",
      temoins: "M. Diallo (magasinier), caméra N°4",
      delaiReponseJours: 7, dateEnvoiDocument: jours(-17),
      dateEnvoiEmploye: dateEnvD, dateReponseAttendue: dateAttD,
      modeRemise: "EN_MAIN_PROPRE", dateRemiseEffective: dateEnvD,
      dateReponseReelle: dateRepD, statutReponse: "DANS_DELAI",
    }})
    await prisma.document.create({ data: { nom: "demande_explication_conde.pdf", type: "DOCUMENT_RH", url: "demo-doc-rh-conde.pdf", taille: 128000, mimeType: "application/pdf", uploadeParId: admin.id, dossierDisciplinaireId: dosD.id, createdAt: jours(-17) }})
    await prisma.document.create({ data: { nom: "reponse_conde_scan.pdf", type: "REPONSE_EMPLOYE", url: "demo-reponse-conde.pdf", taille: 95000, mimeType: "application/pdf", uploadeParId: resp.id, dossierDisciplinaireId: dosD.id, createdAt: dateRepD }})
    await prisma.auditLog.createMany({ data: [
      { dossierId: dosD.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "CREATION", description: "Procédure initiée — Faute professionnelle — Gravité : CRITIQUE", createdAt: jours(-20) },
      { dossierId: dosD.id, auteurId: admin.id, auteurNom: "Admin RH", type: "DOC_RH", description: "Document officiel uploadé", createdAt: jours(-17) },
      { dossierId: dosD.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "TRANSMISSION", description: "Document transmis en main propre — délai : 7 j", createdAt: dateEnvD },
      { dossierId: dosD.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "ACCUSE_RECU", description: "Accusé de réception uploadé — mode : EN_MAIN_PROPRE", createdAt: jours(-13) },
      { dossierId: dosD.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "REPONSE", description: "Réponse de l'employé reçue — DANS les délais (2 jours avant l'échéance)", createdAt: dateRepD },
    ]})
    await prisma.noteInterne.create({ data: { dossierId: dosD.id, auteurId: admin.id, auteurNom: "Admin RH", contenu: "M. Condé invoque une surcharge de travail et un oubli non intentionnel. À vérifier avec le planning de ce jour-là.", createdAt: jours(-8) }})
    await prisma.noteInterne.create({ data: { dossierId: dosD.id, auteurId: admin.id, auteurNom: "Admin RH", contenu: "DRH à consulter avant décision finale — faute potentiellement lourde.", createdAt: jours(-6) }})
    await prisma.notification.create({ data: { userId: admin.id, type: "REPONSE_RECUE", titre: "Réponse reçue — dans les délais", message: "Mamadou Condé a répondu dans les délais. Traitement prioritaire.", dossierId: dosD.id, createdAt: dateRepD }})

    // ── Scénario E : REPONSE_RECUE — HORS DÉLAI + sanction auto ───────────
    const dateEnvE   = jours(-21)
    const dateAttE   = jours(-14)
    const dateRepE   = jours(-10) // réponse après l'échéance ✗
    const dosE = await prisma.dossierDisciplinaire.create({ data: {
      employeId: emp5.id, type: "DEMANDE_EXPLICATION",
      date: jours(-25), motif: "Comportement inapproprié avec un client",
      description: "M. Diallo a eu un échange verbal vif avec un client le 2 juin en salle d'attente, en présence d'autres usagers. Plusieurs témoins ont rapporté l'incident.",
      statut: "REPONSE_RECUE", initiePar: resp.id,
      categoriesFaits: "COMPORTEMENT", niveauGravite: "ELEVE",
      temoins: "Mme Bah (réception), client M. Sory Keïta",
      delaiReponseJours: 7, dateEnvoiDocument: jours(-24),
      dateEnvoiEmploye: dateEnvE, dateReponseAttendue: dateAttE,
      modeRemise: "COURRIER_RECOMMANDE", dateRemiseEffective: jours(-20),
      dateReponseReelle: dateRepE, statutReponse: "HORS_DELAI",
      sanctionAutoAppliquee: true,
    }})
    await prisma.document.create({ data: { nom: "demande_explication_diallo.pdf", type: "DOCUMENT_RH", url: "demo-doc-rh-diallo.pdf", taille: 110000, mimeType: "application/pdf", uploadeParId: admin.id, dossierDisciplinaireId: dosE.id, createdAt: jours(-24) }})
    await prisma.document.create({ data: { nom: "reponse_diallo_tardive.pdf", type: "REPONSE_EMPLOYE", url: "demo-reponse-diallo.pdf", taille: 76000, mimeType: "application/pdf", uploadeParId: resp.id, dossierDisciplinaireId: dosE.id, createdAt: dateRepE }})
    // Sanction auto associée
    const sanctAuto = await prisma.dossierDisciplinaire.create({ data: {
      employeId: emp5.id, type: "AVERTISSEMENT",
      date: dateRepE, motif: "Non-respect du délai de réponse",
      description: "Sanction automatique suite au non-respect du délai de réponse à la demande d'explication du " + jours(-25).toLocaleDateString("fr-FR") + ". Délai : 7 jours. Reçu le " + dateRepE.toLocaleDateString("fr-FR") + ".",
      statut: "INITIE", initiePar: admin.id, delaiReponseJours: 5,
    }})
    await prisma.dossierDisciplinaire.update({ where: { id: dosE.id }, data: { sanctionAutoRef: sanctAuto.id }})
    await prisma.auditLog.createMany({ data: [
      { dossierId: dosE.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "CREATION", description: "Procédure initiée — Comportement inapproprié", createdAt: jours(-25) },
      { dossierId: dosE.id, auteurId: admin.id, auteurNom: "Admin RH", type: "DOC_RH", description: "Document officiel uploadé", createdAt: jours(-24) },
      { dossierId: dosE.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "TRANSMISSION", description: "Document transmis par courrier recommandé", createdAt: dateEnvE },
      { dossierId: dosE.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "REPONSE", description: "Réponse reçue — HORS DÉLAI (4 jours après l'échéance)", createdAt: dateRepE },
      { dossierId: dosE.id, auteurId: admin.id, auteurNom: "Système", type: "SANCTION_AUTO", description: "Sanction automatique créée — avertissement pour non-respect du délai", createdAt: dateRepE },
    ]})
    await prisma.notification.create({ data: { userId: admin.id, type: "REPONSE_RECUE", titre: "⚠ Réponse HORS DÉLAI — Sanction auto", message: "Thierno Diallo a répondu HORS DÉLAI. Sanction automatique appliquée.", dossierId: dosE.id, lu: false, createdAt: dateRepE }})

    // ── Scénario F : CLOS — décision prise ────────────────────────────────
    const dateEnvF  = jours(-40)
    const dateAttF  = jours(-33)
    const dateRepF  = jours(-35)
    const dosF = await prisma.dossierDisciplinaire.create({ data: {
      employeId: emp6.id, type: "DEMANDE_EXPLICATION",
      date: jours(-45), motif: "Utilisation non autorisée des ressources informatiques",
      description: "Mme Camara a été identifiée utilisant les ressources informatiques de l'entreprise à des fins personnelles pendant les heures de travail, notamment des transactions financières personnelles.",
      statut: "CLOS", initiePar: resp.id,
      categoriesFaits: "FAUTE_PRO", niveauGravite: "MODERE",
      delaiReponseJours: 7, dateEnvoiDocument: jours(-44),
      dateEnvoiEmploye: dateEnvF, dateReponseAttendue: dateAttF,
      modeRemise: "EN_MAIN_PROPRE", dateRemiseEffective: dateEnvF,
      dateReponseReelle: dateRepF, statutReponse: "DANS_DELAI",
      appreciationRH: "Après analyse de la réponse de Mme Camara, les faits sont partiellement reconnus. L'employée invoque un manque de sensibilisation aux règles d'utilisation du matériel. Les transactions identifiées restent d'un montant modeste et ponctuelles. Première occurrence.",
      decisionFinale: "PARTIELLEMENT_ACCEPTEE",
      sanctionRetenue: "Avertissement écrit + formation obligatoire sur la charte informatique",
      dateNotificationDecision: jours(-28),
    }})
    await prisma.document.create({ data: { nom: "demande_explication_camara.pdf", type: "DOCUMENT_RH", url: "demo-doc-rh-camara.pdf", taille: 98000, mimeType: "application/pdf", uploadeParId: admin.id, dossierDisciplinaireId: dosF.id }})
    await prisma.document.create({ data: { nom: "reponse_camara.pdf", type: "REPONSE_EMPLOYE", url: "demo-reponse-camara.pdf", taille: 65000, mimeType: "application/pdf", uploadeParId: resp.id, dossierDisciplinaireId: dosF.id }})
    await prisma.document.create({ data: { nom: "decision_camara.pdf", type: "DOCUMENT_DECISION", url: "demo-decision-camara.pdf", taille: 78000, mimeType: "application/pdf", uploadeParId: admin.id, dossierDisciplinaireId: dosF.id }})
    await prisma.auditLog.createMany({ data: [
      { dossierId: dosF.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "CREATION", description: "Procédure initiée — Utilisation non autorisée des ressources", createdAt: jours(-45) },
      { dossierId: dosF.id, auteurId: admin.id, auteurNom: "Admin RH", type: "DOC_RH", description: "Document officiel uploadé", createdAt: jours(-44) },
      { dossierId: dosF.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "TRANSMISSION", description: "Document transmis en main propre", createdAt: dateEnvF },
      { dossierId: dosF.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "ACCUSE_RECU", description: "Accusé de réception signé — mode : EN_MAIN_PROPRE", createdAt: jours(-39) },
      { dossierId: dosF.id, auteurId: resp.id, auteurNom: "M. Dupont (Responsable)", type: "REPONSE", description: "Réponse reçue DANS les délais (2 jours avant échéance)", createdAt: dateRepF },
      { dossierId: dosF.id, auteurId: admin.id, auteurNom: "Admin RH", type: "ANALYSE", description: "Analyse RH terminée — Décision : Explication partiellement acceptée → sanction allégée", createdAt: jours(-30) },
      { dossierId: dosF.id, auteurId: admin.id, auteurNom: "Admin RH", type: "DECISION", description: "Document de décision uploadé", createdAt: jours(-29) },
      { dossierId: dosF.id, auteurId: admin.id, auteurNom: "Admin RH", type: "CLOTURE", description: "Dossier clôturé — décision notifiée le " + jours(-28).toLocaleDateString("fr-FR"), createdAt: jours(-28) },
    ]})
    await prisma.noteInterne.create({ data: { dossierId: dosF.id, auteurId: admin.id, auteurNom: "Admin RH", contenu: "Décision validée avec la direction. Formation charte informatique planifiée pour juillet 2026.", createdAt: jours(-29) }})

    // ── Scénario G : Avertissement classique (procédures) ─────────────────
    for (const [emp, motif, desc] of [
      [allEmps[0], "Non-respect des consignes de sécurité", "Port des EPI non respecté à plusieurs reprises malgré rappels."],
      [allEmps[1], "Abandon de poste temporaire", "Absence du poste de travail de 11h15 à 13h30 sans autorisation le 8 juin."],
    ] as [typeof allEmps[0], string, string][]) {
      await prisma.dossierDisciplinaire.create({ data: {
        employeId: emp.id, type: rand(["AVERTISSEMENT","BLAME"]),
        date: jours(-randInt(10,60)), motif, description: desc,
        statut: rand(["INITIE","DOCUMENT_PRET","CLOS"]),
        initiePar: resp.id, delaiReponseJours: 5,
        categoriesFaits: "COMPORTEMENT", niveauGravite: rand(["FAIBLE","MODERE"]),
      }})
    }

    console.log("  + Dossiers disciplinaires injectés (6 scénarios complets)")
  } else {
    console.log("  ~ Dossiers disciplinaires déjà présents, ignorés")
  }

  // ── 7. Notifications supplémentaires ──────────────────────────────────────

  const notifCount = await prisma.notification.count({ where: { userId: admin.id, lu: false } })
  if (notifCount < 3) {
    await prisma.notification.createMany({ data: [
      { userId: admin.id, type: "DEMANDE_INITIE",  titre: "Rappel — 2 dossiers en attente", message: "Les dossiers Sow et Baldé attendent votre action (upload document RH).", lu: false },
      { userId: admin.id, type: "DELAI_DEPASSE",   titre: "⚠ Délai urgent — Traoré", message: "La demande pour Fatoumata Traoré expire dans 2 jours.", lu: false },
      { userId: resp.id,  type: "DOCUMENT_PRET",   titre: "Document prêt — Baldé", message: "Le document officiel pour Oumar Baldé est disponible. Transmettez-le à l'employé.", lu: false },
    ]})
    console.log("  + Notifications injectées")
  }

  console.log("\n✅ Seed démo terminé avec succès !")
  console.log("   → http://localhost:3003")
  console.log("   → admin@monrh.com / admin123")
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
