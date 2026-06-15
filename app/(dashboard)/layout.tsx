import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session.user as any)?.role === "EMPLOYE") redirect("/mon-espace")

  const userName    = session.user?.name ?? "Administrateur"
  const userInitial = userName[0]?.toUpperCase() ?? "A"

  return (
    <DashboardShell userName={userName} userInitial={userInitial}>
      {children}
    </DashboardShell>
  )
}
