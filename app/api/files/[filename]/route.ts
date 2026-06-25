import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 })

  const { filename } = await params

  // Empêcher traversal de répertoire
  const safe = filename.replace(/[^a-zA-Z0-9.\-_]/g, "")
  if (!safe || safe !== filename) {
    return NextResponse.json({ message: "Nom de fichier invalide" }, { status: 400 })
  }

  const uploadBase = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads")
  const filepath   = join(uploadBase, "disciplinaire", safe)
  if (!existsSync(filepath)) {
    return NextResponse.json({ message: "Fichier introuvable" }, { status: 404 })
  }

  const buffer = await readFile(filepath)

  const ext = safe.split(".").pop()?.toLowerCase() ?? ""
  const mimeTypes: Record<string, string> = {
    pdf:  "application/pdf",
    png:  "image/png",
    jpg:  "image/jpeg",
    jpeg: "image/jpeg",
    doc:  "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
  const contentType = mimeTypes[ext] ?? "application/octet-stream"

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":        contentType,
      "Content-Disposition": `inline; filename="${safe}"`,
    },
  })
}
