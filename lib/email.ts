import { Resend } from "resend";

export async function sendOwnerEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    return { skipped: true };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Recovery OS <onboarding@resend.dev>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  return { skipped: false };
}
