-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "dateEval" DATETIME NOT NULL,
    "evaluateur" TEXT NOT NULL,
    "scoreGlobal" REAL NOT NULL,
    "commentaire" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Evaluation_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "critere" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    CONSTRAINT "NoteEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "heureFin" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#3b82f6',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AffectationShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffectationShift_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AffectationShift_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "heureArrivee" TEXT,
    "heureDepart" TEXT,
    "heuresTravaillees" REAL,
    "minutesRetard" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Presence_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
