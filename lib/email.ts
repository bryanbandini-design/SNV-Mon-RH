import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}) {
  const { data, error } = await resend.emails.send({
    from: "Mon RH <reporting@sanoviahc.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })
  if (error) throw new Error(error.message)
  return data
}
