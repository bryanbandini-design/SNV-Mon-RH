import { prisma } from "@/lib/prisma"
import type { Session } from "next-auth"

export type LogModule =
  | "AUTH"
  | "EMPLOYES"
  | "CONGES"
  | "SALAIRES"
  | "EVALUATIONS"
  | "DISCIPLINAIRE"
  | "POINTAGE"
  | "HORAIRES"
  | "DOCUMENTS"
  | "RECRUTEMENT"
  | "FORMATIONS"
  | "PARAMETRES"

export type LogAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "UPLOAD"
  | "ENROLL_FACE"
  | "POINTAGE_ENTREE"
  | "POINTAGE_CONFIRME"
  | "POINTAGE_SORTIE"

interface LogPayload {
  session?: Session | null
  userId?: string
  userName?: string
  userRole?: string
  action: LogAction
  module: LogModule
  description: string
  entityId?: string
  entityType?: string
  metadata?: Record<string, unknown>
}

export async function logActivity(payload: LogPayload): Promise<void> {
  try {
    const user = payload.session?.user as any
    await prisma.activityLog.create({
      data: {
        userId:      payload.userId      ?? user?.id      ?? null,
        userName:    payload.userName    ?? user?.name    ?? null,
        userRole:    payload.userRole    ?? user?.role    ?? null,
        action:      payload.action,
        module:      payload.module,
        description: payload.description,
        entityId:    payload.entityId   ?? null,
        entityType:  payload.entityType ?? null,
        metadata:    payload.metadata ? JSON.stringify(payload.metadata) : null,
      },
    })
  } catch {
    // Logging non-bloquant : ne doit jamais faire échouer la requête métier
  }
}
