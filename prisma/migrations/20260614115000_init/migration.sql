-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Employe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricule" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "dateNaissance" DATETIME,
    "lieuNaissance" TEXT,
    "adresse" TEXT,
    "nationalite" TEXT,
    "numeroCni" TEXT,
    "poste" TEXT NOT NULL,
    "departement" TEXT,
    "typeContrat" TEXT NOT NULL,
    "dateEmbauche" DATETIME NOT NULL,
    "dateFinContrat" DATETIME,
    "salaireBase" REAL NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Conge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME NOT NULL,
    "nbJours" INTEGER NOT NULL,
    "motif" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conge_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DossierDisciplinaire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "motif" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "sanctions" TEXT,
    "suites" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DossierDisciplinaire_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoriqueSalaire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeId" TEXT NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "salaireBase" REAL NOT NULL,
    "primes" REAL NOT NULL DEFAULT 0,
    "retenues" REAL NOT NULL DEFAULT 0,
    "netAPayer" REAL NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "datePaiement" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoriqueSalaire_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "employeId" TEXT,
    "dossierDisciplinaireId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_dossierDisciplinaireId_fkey" FOREIGN KEY ("dossierDisciplinaireId") REFERENCES "DossierDisciplinaire" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employe_matricule_key" ON "Employe"("matricule");
