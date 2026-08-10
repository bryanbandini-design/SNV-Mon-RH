import { Resend } from "resend"

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY non configurée")
  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from: "Mon RH <reporting@sanoviahc.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })
  if (error) throw new Error(error.message)
  return data
}
