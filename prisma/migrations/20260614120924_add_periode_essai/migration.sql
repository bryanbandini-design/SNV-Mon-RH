-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employe" (
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
    "periodeEssai" BOOLEAN NOT NULL DEFAULT false,
    "dateDebutEssai" DATETIME,
    "dateFinEssai" DATETIME,
    "salaireBase" REAL NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "photoUrl" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Employe" ("adresse", "createdAt", "dateEmbauche", "dateFinContrat", "dateNaissance", "departement", "email", "id", "lieuNaissance", "matricule", "nationalite", "nom", "notes", "numeroCni", "photoUrl", "poste", "prenom", "salaireBase", "statut", "telephone", "typeContrat", "updatedAt") SELECT "adresse", "createdAt", "dateEmbauche", "dateFinContrat", "dateNaissance", "departement", "email", "id", "lieuNaissance", "matricule", "nationalite", "nom", "notes", "numeroCni", "photoUrl", "poste", "prenom", "salaireBase", "statut", "telephone", "typeContrat", "updatedAt" FROM "Employe";
DROP TABLE "Employe";
ALTER TABLE "new_Employe" RENAME TO "Employe";
CREATE UNIQUE INDEX "Employe_matricule_key" ON "Employe"("matricule");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
