import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log("[Email] SMTP niet geconfigureerd — verificatie-e-mails worden gelogd naar console");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@letsgoradar.nl";
}

function getBaseUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `https://${process.env.REPLIT_DEPLOYMENT_URL}`;
  }
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  return `https://${process.env.REPLIT_DEV_DOMAIN || "localhost:5000"}`;
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  companyName: string
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const verifyUrl = `${baseUrl}/api/advertiser/verify/${token}`;

  const subject = "Verifieer je bedrijfsaccount — letsgo radar";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; font-size: 24px;">Welkom bij letsgo radar!</h1>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        Hallo <strong>${companyName}</strong>,
      </p>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">
        Bedankt voor je registratie als adverteerder op letsgo radar. Klik op de onderstaande knop om je bedrijfs e-mailadres te verifiëren en je account te activeren.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold;">
          E-mail verifiëren
        </a>
      </div>
      <p style="color: #888; font-size: 14px; line-height: 1.5;">
        Of kopieer deze link in je browser:<br>
        <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
      </p>
      <p style="color: #888; font-size: 14px; line-height: 1.5;">
        Deze link is 24 uur geldig. Als je je niet hebt geregistreerd, kun je deze e-mail negeren.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #aaa; font-size: 12px;">
        letsgo radar — Ontdek evenementen in je buurt
      </p>
    </div>
  `;

  const transport = getTransporter();

  if (!transport) {
    console.log("\n========================================");
    console.log("[Email] VERIFICATIE E-MAIL (dev mode)");
    console.log(`Aan: ${email}`);
    console.log(`Bedrijf: ${companyName}`);
    console.log(`Verificatie URL: ${verifyUrl}`);
    console.log("========================================\n");
    return true;
  }

  try {
    await transport.sendMail({
      from: `letsgo radar <${getFromAddress()}>`,
      to: email,
      subject,
      html,
    });
    console.log(`[Email] Verificatie-e-mail verzonden naar ${email}`);
    return true;
  } catch (error) {
    console.error(`[Email] Fout bij verzenden naar ${email}:`, error);
    return false;
  }
}
