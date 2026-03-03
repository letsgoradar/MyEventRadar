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

export async function sendFeedbackNotification(feedback: {
  feedbackType: string;
  message: string;
  pageUrl: string;
  username?: string;
  rating?: number | null;
  email?: string | null;
}): Promise<boolean> {
  const typeLabels: Record<string, string> = {
    bug: "Bug 🐛",
    idee: "Idee 💡",
    vraag: "Vraag ❓",
    anders: "Anders 📝",
  };

  const subject = `[letsgo radar BETA] Nieuwe feedback: ${typeLabels[feedback.feedbackType] || feedback.feedbackType}`;

  const ratingHtml = feedback.rating
    ? `<p><strong>Rating:</strong> ${"★".repeat(feedback.rating)}${"☆".repeat(5 - feedback.rating)} (${feedback.rating}/5)</p>`
    : "";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; font-size: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        ${typeLabels[feedback.feedbackType] || feedback.feedbackType} — Nieuwe Beta Feedback
      </h2>
      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #333; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${feedback.message}</p>
      </div>
      ${ratingHtml}
      <table style="width: 100%; font-size: 14px; color: #555;">
        <tr><td style="padding: 4px 0;"><strong>Pagina:</strong></td><td>${feedback.pageUrl}</td></tr>
        <tr><td style="padding: 4px 0;"><strong>Gebruiker:</strong></td><td>${feedback.username || "Anoniem"}</td></tr>
        ${feedback.email ? `<tr><td style="padding: 4px 0;"><strong>E-mail:</strong></td><td>${feedback.email}</td></tr>` : ""}
        <tr><td style="padding: 4px 0;"><strong>Tijdstip:</strong></td><td>${new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #aaa; font-size: 12px;">
        letsgo radar BETA — Feedback systeem
      </p>
    </div>
  `;

  const transport = getTransporter();
  const notificationEmail = "info@letsgoradar.com";

  if (!transport) {
    console.log("\n========================================");
    console.log("[Email] FEEDBACK NOTIFICATIE (dev mode)");
    console.log(`Aan: ${notificationEmail}`);
    console.log(`Type: ${feedback.feedbackType}`);
    console.log(`Bericht: ${feedback.message}`);
    console.log(`Pagina: ${feedback.pageUrl}`);
    console.log(`Gebruiker: ${feedback.username || "Anoniem"}`);
    if (feedback.rating) console.log(`Rating: ${feedback.rating}/5`);
    if (feedback.email) console.log(`Contact: ${feedback.email}`);
    console.log("========================================\n");
    return true;
  }

  try {
    await transport.sendMail({
      from: `letsgo radar <${getFromAddress()}>`,
      to: notificationEmail,
      subject,
      html,
    });
    console.log(`[Email] Feedback notificatie verzonden naar ${notificationEmail}`);
    return true;
  } catch (error) {
    console.error(`[Email] Fout bij verzenden feedback notificatie:`, error);
    return false;
  }
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
