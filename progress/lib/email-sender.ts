import nodemailer from 'nodemailer'

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  )
}

export async function sendMail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    })

    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text: body,
    })

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
