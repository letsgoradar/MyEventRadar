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

export async function sendTrafficAlertEmail(
  level: "warning" | "critical" | "circuit_breaker_on" | "circuit_breaker_off",
  stats: { requestsPerMin: number; uniqueIps: number; topEndpoints: { endpoint: string; count: number }[]; humanRequests?: number; topBots?: { name: string; count: number }[] }
): Promise<boolean> {
  const levelLabels: Record<string, { label: string; color: string; icon: string }> = {
    warning: { label: "Waarschuwing — Hoog verkeer", color: "#f59e0b", icon: "⚠️" },
    critical: { label: "KRITIEK — Zeer hoog verkeer", color: "#ef4444", icon: "🚨" },
    circuit_breaker_on: { label: "CIRCUIT BREAKER GEACTIVEERD", color: "#ef4444", icon: "🛑" },
    circuit_breaker_off: { label: "Circuit breaker gedeactiveerd", color: "#22c55e", icon: "✅" },
  };

  const info = levelLabels[level] || levelLabels.warning;
  const subject = `${info.icon} letsgo radar — ${info.label}`;

  const endpointsHtml = stats.topEndpoints
    .map(e => `<tr><td style="padding: 4px 8px; border-bottom: 1px solid #eee;">${e.endpoint}</td><td style="padding: 4px 8px; border-bottom: 1px solid #eee; text-align: right;">${e.count}</td></tr>`)
    .join("");

  const botTotal = stats.topBots?.reduce((s, b) => s + b.count, 0) ?? 0;
  const humanReqs = stats.humanRequests ?? (stats.requestsPerMin - botTotal);
  const botSummary = botTotal > 0
    ? `🤖 ${botTotal} bot (${stats.topBots!.map(b => `${b.name}: ${b.count}`).join(", ")}) / 👤 ${humanReqs} menselijk`
    : `👤 ${humanReqs} menselijk (geen bekende bots)`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
        <div style="background: ${info.color}; color: white; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 20px;">${info.icon} ${info.label}</h2>
        </div>
        <table style="width: 100%; font-size: 15px; margin-bottom: 20px;">
          <tr><td style="padding: 6px 0; color: #555;"><strong>Requests/minuut:</strong></td><td style="text-align: right; font-size: 18px; font-weight: bold; color: ${info.color};">${stats.requestsPerMin}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;"><strong>Unieke IP-adressen:</strong></td><td style="text-align: right;">${stats.uniqueIps}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;"><strong>Bron:</strong></td><td style="text-align: right; font-size: 13px;">${botSummary}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;"><strong>Tijdstip:</strong></td><td style="text-align: right;">${new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })}</td></tr>
        </table>
        ${stats.topEndpoints.length > 0 ? `
          <h3 style="font-size: 14px; color: #333; margin-bottom: 8px;">Meest bezochte endpoints:</h3>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr style="background: #f3f4f6;"><th style="padding: 6px 8px; text-align: left;">Endpoint</th><th style="padding: 6px 8px; text-align: right;">Aantal</th></tr>
            ${endpointsHtml}
          </table>
        ` : ""}
        ${level === "circuit_breaker_on" ? `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-top: 20px;">
            <p style="color: #991b1b; margin: 0; font-size: 14px;">
              <strong>De app is automatisch gepauzeerd</strong> om kosten te beperken. 
              Alleen inloggen en health-checks zijn nog bereikbaar. 
              De app hervat automatisch na 5 minuten, of je kunt het handmatig beheren via het admin-paneel.
            </p>
          </div>
        ` : ""}
        ${level === "circuit_breaker_off" ? `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-top: 20px;">
            <p style="color: #166534; margin: 0; font-size: 14px;">
              <strong>De app is weer normaal bereikbaar.</strong> Het verkeer is teruggekeerd naar een veilig niveau.
            </p>
          </div>
        ` : ""}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 12px; text-align: center; margin: 0;">
          letsgo radar — Verkeersmonitor
        </p>
      </div>
    </div>
  `;

  const transport = getTransporter();
  const adminEmail = "info@letsgoradar.com";

  if (!transport) {
    console.log("\n========================================");
    console.log(`[Email] TRAFFIC ALERT (dev mode): ${info.label}`);
    console.log(`Requests/min: ${stats.requestsPerMin}`);
    console.log(`Unique IPs: ${stats.uniqueIps}`);
    console.log(`Top endpoints:`, stats.topEndpoints);
    console.log("========================================\n");
    return true;
  }

  try {
    await transport.sendMail({
      from: `letsgo radar <${getFromAddress()}>`,
      to: adminEmail,
      subject,
      html,
    });
    console.log(`[Email] Traffic alert verzonden: ${info.label}`);
    return true;
  } catch (error) {
    console.error(`[Email] Fout bij verzenden traffic alert:`, error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  username: string,
  resetUrl: string
): Promise<boolean> {
  const subject = "Wachtwoord resetten — letsgo radar";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="background: #00A9C5; display: inline-block; padding: 12px 24px; border-radius: 8px;">
            <span style="color: white; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">letsgo&#33; radar&#46;nl</span>
          </div>
        </div>
        <h2 style="color: #111; font-size: 22px; margin: 0 0 12px;">Wachtwoord resetten</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
          Hoi ${username}, je hebt een verzoek ingediend om je wachtwoord te resetten.
          Klik op de knop hieronder om een nieuw wachtwoord in te stellen.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #00A9C5; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: bold;">
            Nieuw wachtwoord instellen
          </a>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          Of kopieer deze link in je browser:<br>
          <a href="${resetUrl}" style="color: #00A9C5; word-break: break-all;">${resetUrl}</a>
        </p>
        <p style="color: #888; font-size: 13px; line-height: 1.5; margin-top: 16px;">
          Deze link is 30 minuten geldig. Als je geen wachtwoord-reset hebt aangevraagd, kun je deze e-mail negeren.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 12px; text-align: center; margin: 0;">
          letsgo radar — Ontdek evenementen in je buurt
        </p>
      </div>
    </div>
  `;

  const transport = getTransporter();

  if (!transport) {
    console.log("\n========================================");
    console.log("[Email] WACHTWOORD RESET E-MAIL (dev mode)");
    console.log(`Aan: ${email}`);
    console.log(`Gebruiker: ${username}`);
    console.log(`Reset URL: ${resetUrl}`);
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
    console.log(`[Email] Wachtwoord reset e-mail verzonden naar ${email}`);
    return true;
  } catch (error) {
    console.error(`[Email] Fout bij verzenden wachtwoord reset e-mail:`, error);
    return false;
  }
}

export async function sendUserVerificationEmail(
  email: string,
  username: string,
  token: string,
  requestBaseUrl?: string
): Promise<boolean> {
  const baseUrl = requestBaseUrl || getBaseUrl();
  const verifyUrl = `${baseUrl}/api/auth/verify-email/${token}`;

  const subject = "Bevestig je e-mailadres — letsgo radar";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="background: #00A9C5; display: inline-block; padding: 12px 24px; border-radius: 8px;">
            <span style="color: white; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">letsgo&#33; radar&#46;nl</span>
          </div>
        </div>
        <h2 style="color: #111; font-size: 22px; margin: 0 0 12px;">Bijna klaar, ${username}!</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
          Bedankt voor je registratie. Klik op de knop hieronder om je e-mailadres te bevestigen en je account te activeren.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background-color: #00A9C5; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: bold;">
            E-mailadres bevestigen
          </a>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          Of kopieer deze link in je browser:<br>
          <a href="${verifyUrl}" style="color: #00A9C5; word-break: break-all;">${verifyUrl}</a>
        </p>
        <p style="color: #888; font-size: 13px; line-height: 1.5; margin-top: 16px;">
          Deze link is 24 uur geldig. Als je je niet hebt geregistreerd, kun je deze e-mail negeren.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 12px; text-align: center; margin: 0;">
          letsgo radar — Ontdek evenementen in je buurt
        </p>
      </div>
    </div>
  `;

  const transport = getTransporter();

  if (!transport) {
    console.log("\n========================================");
    console.log("[Email] GEBRUIKER VERIFICATIE E-MAIL (dev mode)");
    console.log(`Aan: ${email}`);
    console.log(`Gebruiker: ${username}`);
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
    console.error(`[Email] Fout bij verzenden verificatie naar ${email}:`, error);
    return false;
  }
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  companyName: string,
  requestBaseUrl?: string
): Promise<boolean> {
  const baseUrl = requestBaseUrl || getBaseUrl();
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

export async function sendWelcomeEmail(
  email: string,
  username: string
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const appUrl = `${baseUrl}/web`;

  const subject = "Welkom bij letsgo radar! 🎉";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="background: #00A9C5; display: inline-block; padding: 12px 24px; border-radius: 8px;">
            <span style="color: white; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">letsgo&#33; radar&#46;nl</span>
          </div>
        </div>
        <h2 style="color: #111; font-size: 24px; margin: 0 0 8px;">Welkom, ${username}!</h2>
        <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          Je account is actief. Fijn dat je erbij bent! Dit is wat je kunt doen met je account:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top;">
              <div style="background: #f0fdfa; border-radius: 8px; padding: 12px 16px; display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 22px; line-height: 1;">🗺️</span>
                <div>
                  <strong style="color: #111; font-size: 14px;">Evenementen ontdekken</strong>
                  <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Bekijk honderden lokale evenementen op de interactieve kaart en filter op categorie, datum of afstand.</p>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top;">
              <div style="background: #f0fdfa; border-radius: 8px; padding: 12px 16px;">
                <span style="font-size: 22px; line-height: 1;">❤️</span>
                <strong style="color: #111; font-size: 14px; margin-left: 8px;">Favorieten bewaren</strong>
                <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Sla interessante evenementen op als favoriet zodat je ze makkelijk terugvindt.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top;">
              <div style="background: #f0fdfa; border-radius: 8px; padding: 12px 16px;">
                <span style="font-size: 22px; line-height: 1;">🎟️</span>
                <strong style="color: #111; font-size: 14px; margin-left: 8px;">Aanmelden voor evenementen</strong>
                <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Geef aan dat je aanwezig bent en zie wie er nog meer naartoe gaan.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; vertical-align: top;">
              <div style="background: #f0fdfa; border-radius: 8px; padding: 12px 16px;">
                <span style="font-size: 22px; line-height: 1;">📅</span>
                <strong style="color: #111; font-size: 14px; margin-left: 8px;">Eigen evenementen aanmaken</strong>
                <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Organiseer je eigen evenement en bereik mensen in de buurt via de kaart.</p>
              </div>
            </td>
          </tr>
        </table>
        <div style="text-align: center; margin: 28px 0 20px;">
          <a href="${appUrl}" style="display: inline-block; background-color: #00A9C5; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 16px; font-weight: bold;">
            Ga naar de kaart
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #bbb; font-size: 12px; text-align: center; margin: 0;">
          letsgo radar — Ontdek evenementen in je buurt
        </p>
      </div>
    </div>
  `;

  const transport = getTransporter();

  if (!transport) {
    console.log("\n========================================");
    console.log("[Email] WELKOMST E-MAIL (dev mode)");
    console.log(`Aan: ${email}`);
    console.log(`Gebruiker: ${username}`);
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
    console.log(`[Email] Welkomst-e-mail verzonden naar ${email}`);
    return true;
  } catch (error) {
    console.error(`[Email] Fout bij verzenden welkomst naar ${email}:`, error);
    return false;
  }
}

export async function sendFeedPausedNotification(feed: {
  id: number;
  name: string;
  url: string;
  municipality: string | null;
  consecutiveFailures: number;
  lastErrorMessage: string | null;
}, failureHistory: Array<{ attemptedAt: Date; errorMessage: string }>): Promise<boolean> {
  const adminEmail = "info@letsgoradar.com";
  const subject = `[letsgo radar] Feed gepauzeerd na 3 mislukte pogingen: ${feed.name}`;
  const baseUrl = getBaseUrl();

  const attemptsHtml = failureHistory.map((attempt, i) => `
    <tr style="background: ${i % 2 === 0 ? '#fff' : '#f8f9fa'};">
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; font-size: 13px; white-space: nowrap;">
        ${attempt.attemptedAt.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
      </td>
      <td style="padding: 8px 12px; border: 1px solid #dee2e6; font-size: 13px; font-family: monospace; color: #dc3545; word-break: break-all;">
        ${attempt.errorMessage}
      </td>
    </tr>`).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #dc3545; font-size: 20px; border-bottom: 2px solid #dc3545; padding-bottom: 10px; margin-top: 0;">
        ⚠️ Feed gepauzeerd na 3 achtereenvolgende fouten
      </h2>

      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 15px; color: #664d03;">
          De feed <strong>${feed.name}</strong> is automatisch op <strong>pauze</strong> gezet omdat 3 opeenvolgende synchronisatiepogingen zijn mislukt.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 12px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: bold; width: 30%;">Feed naam</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${feed.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: bold;">Gemeente</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6;">${feed.municipality || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: bold;">URL</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6; word-break: break-all; font-family: monospace; font-size: 12px;">${feed.url}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f8f9fa; border: 1px solid #dee2e6; font-weight: bold;">Laatste fout</td>
          <td style="padding: 8px 12px; border: 1px solid #dee2e6; color: #dc3545; font-family: monospace; font-size: 12px; word-break: break-all;">${feed.lastErrorMessage || '—'}</td>
        </tr>
      </table>

      <h3 style="font-size: 16px; color: #333; margin-bottom: 10px;">Overzicht van de mislukte pogingen</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #dc3545; color: white;">
            <th style="padding: 8px 12px; border: 1px solid #c82333; text-align: left; font-size: 13px;">Tijdstip (Amsterdam)</th>
            <th style="padding: 8px 12px; border: 1px solid #c82333; text-align: left; font-size: 13px;">Foutmelding</th>
          </tr>
        </thead>
        <tbody>
          ${attemptsHtml}
        </tbody>
      </table>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${baseUrl}/admin/rss-feeds"
           style="display: inline-block; background: #00A9C5; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
          Beheer feeds in admin →
        </a>
      </div>

      <p style="font-size: 13px; color: #6c757d; margin-top: 20px; border-top: 1px solid #dee2e6; padding-top: 12px;">
        Je kunt de feed handmatig heractiveren in het admin paneel (RSS Feeds → bewerk → status terug naar actief),
        of gebruik de knop "Retry fouten" om alle gepauzeerde feeds opnieuw te proberen.
        <br><br>
        letsgo radar — automatisch bericht
      </p>
    </div>
  `;

  const t = getTransporter();
  if (!t) {
    console.log(`[Email][FeedPaused] SMTP niet beschikbaar — feed gepauzeerd: ${feed.name} (${feed.url})\nFouten:\n${failureHistory.map(f => `  • ${f.attemptedAt.toISOString()} — ${f.errorMessage}`).join('\n')}`);
    return false;
  }
  try {
    await t.sendMail({
      from: `letsgo radar <${getFromAddress()}>`,
      to: adminEmail,
      subject,
      html,
    });
    console.log(`[Email] Feed-gepauzeerd melding verzonden voor ${feed.name}`);
    return true;
  } catch (error) {
    console.error(`[Email] Fout bij verzenden feed-gepauzeerd melding:`, error);
    return false;
  }
}

export async function sendDailyDigest(): Promise<boolean> {
  const adminEmail = "info@letsgoradar.com";
  const baseUrl = getBaseUrl();
  const adminUrl = `${baseUrl}/admin/rss-feeds`;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const dateLabel = now.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });

  const subject = `[letsgo radar] Dagelijks feedrapport — ${dateLabel}`;

  let allFeeds: Array<{
    id: number;
    name: string;
    municipality: string | null;
    status: string;
    lastFetchedAt: Date | null;
    lastErrorMessage: string | null;
    consecutiveFailures: number | null;
    itemsImported: number | null;
  }> = [];

  let newEvents: Array<{
    title: string;
    category: string;
    address: string | null;
    feedName: string | null;
    createdAt: Date | null;
  }> = [];

  try {
    const { db } = await import("../db");
    const { rssFeeds, rssFeedItems, events } = await import("@shared/schema");
    const { gte, isNotNull, eq, asc, desc } = await import("drizzle-orm");

    allFeeds = await db
      .select({
        id: rssFeeds.id,
        name: rssFeeds.name,
        municipality: rssFeeds.municipality,
        status: rssFeeds.status,
        lastFetchedAt: rssFeeds.lastFetchedAt,
        lastErrorMessage: rssFeeds.lastErrorMessage,
        consecutiveFailures: rssFeeds.consecutiveFailures,
        itemsImported: rssFeeds.itemsImported,
      })
      .from(rssFeeds)
      .orderBy(asc(rssFeeds.name));

    const recentItems = await db
      .select({
        title: events.title,
        category: events.category,
        address: events.address,
        createdAt: events.createdAt,
        feedName: rssFeeds.name,
      })
      .from(events)
      .innerJoin(rssFeedItems, eq(rssFeedItems.eventId, events.id))
      .innerJoin(rssFeeds, eq(rssFeeds.id, rssFeedItems.feedId))
      .where(gte(events.createdAt, since24h))
      .orderBy(desc(events.createdAt))
      .limit(50);

    newEvents = recentItems;
  } catch (error) {
    console.error("[Email] Digest: fout bij ophalen data uit DB:", error);
  }

  const activeFeeds = allFeeds.filter((f) => f.status === "active");
  const problemFeeds = allFeeds.filter((f) => f.status === "error" || f.status === "paused");

  function statusBadge(status: string): string {
    if (status === "active") return `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:bold;">actief</span>`;
    if (status === "paused") return `<span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:bold;">gepauzeerd</span>`;
    return `<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:bold;">fout</span>`;
  }

  function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Date(d).toLocaleString("nl-NL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Amsterdam",
    });
  }

  const feedTableRows = allFeeds.map((f, i) =>
    `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${f.name}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#555;">${f.municipality || "—"}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${statusBadge(f.status)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#555;">${fmtDate(f.lastFetchedAt)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${f.itemsImported ?? 0}</td>
    </tr>`
  ).join("");

  const eventRows = newEvents.length > 0
    ? newEvents.map((e, i) =>
        `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"};">
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${e.title}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#555;">${e.category}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#555;">${e.address || "—"}</td>
          <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#555;">${e.feedName || "—"}</td>
        </tr>`
      ).join("")
    : `<tr><td colspan="4" style="padding:12px;color:#9ca3af;text-align:center;font-size:13px;">Geen nieuwe events in de afgelopen 24 uur</td></tr>`;

  const problemSection = problemFeeds.length > 0
    ? `<h2 style="font-size:17px;color:#dc2626;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #fca5a5;">
        ⚠️ Probleem-feeds (${problemFeeds.length})
      </h2>
      ${problemFeeds.map((f) => `
        <div style="background:#fff5f5;border:1px solid #fca5a5;border-radius:8px;padding:14px 16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <div>
              <strong style="font-size:14px;color:#111;">${f.name}</strong>
              <span style="margin-left:8px;">${statusBadge(f.status)}</span>
              ${f.municipality ? `<span style="margin-left:6px;font-size:12px;color:#6b7280;">(${f.municipality})</span>` : ""}
            </div>
            <span style="font-size:12px;color:#9ca3af;white-space:nowrap;">Fouten: ${f.consecutiveFailures ?? 0}</span>
          </div>
          ${f.lastErrorMessage ? `<p style="font-size:12px;font-family:monospace;color:#b91c1c;background:#fef2f2;border-radius:4px;padding:8px 10px;margin:8px 0 0;word-break:break-all;">${f.lastErrorMessage}</p>` : ""}
          <p style="font-size:12px;color:#6b7280;margin:6px 0 0;">Laatste sync: ${fmtDate(f.lastFetchedAt)}</p>
        </div>
      `).join("")}
      <div style="text-align:center;margin:20px 0;">
        <a href="${adminUrl}" style="display:inline-block;background:#dc2626;color:white;padding:11px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
          Beheer probleem-feeds →
        </a>
      </div>`
    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:24px 0;text-align:center;">
        <p style="margin:0;color:#166534;font-size:14px;">✅ Alle feeds functioneren zonder problemen</p>
      </div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;background:#f9fafb;">
      <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="background:#00A9C5;display:inline-block;padding:10px 22px;border-radius:8px;">
            <span style="color:white;font-size:18px;font-weight:bold;letter-spacing:-0.5px;">letsgo&#33; radar</span>
          </div>
          <h1 style="font-size:20px;color:#111;margin:16px 0 4px;">Dagelijks feedrapport</h1>
          <p style="color:#6b7280;font-size:14px;margin:0;">${dateLabel}</p>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:28px;text-align:center;">
          <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:14px;">
            <div style="font-size:26px;font-weight:bold;color:#16a34a;">${activeFeeds.length}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">Actieve feeds</div>
          </div>
          <div style="flex:1;background:${problemFeeds.length > 0 ? "#fff5f5" : "#f9fafb"};border-radius:8px;padding:14px;">
            <div style="font-size:26px;font-weight:bold;color:${problemFeeds.length > 0 ? "#dc2626" : "#6b7280"};">${problemFeeds.length}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">Probleem-feeds</div>
          </div>
          <div style="flex:1;background:#eff6ff;border-radius:8px;padding:14px;">
            <div style="font-size:26px;font-weight:bold;color:#2563eb;">${newEvents.length}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">Nieuwe events (24h)</div>
          </div>
          <div style="flex:1;background:#f9fafb;border-radius:8px;padding:14px;">
            <div style="font-size:26px;font-weight:bold;color:#374151;">${allFeeds.length}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">Feeds totaal</div>
          </div>
        </div>

        ${problemSection}

        <h2 style="font-size:17px;color:#111;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
          📋 Feed-overzicht (${allFeeds.length})
        </h2>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Feed</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Gemeente</th>
                <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Status</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Laatste sync</th>
                <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Geïmporteerd</th>
              </tr>
            </thead>
            <tbody>${feedTableRows}</tbody>
          </table>
        </div>

        <h2 style="font-size:17px;color:#111;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
          🆕 Nieuwe events afgelopen 24 uur (${newEvents.length})
        </h2>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Titel</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Categorie</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Locatie</th>
                <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#374151;">Feed</th>
              </tr>
            </thead>
            <tbody>${eventRows}</tbody>
          </table>
        </div>

        <div style="text-align:center;margin:28px 0 8px;">
          <a href="${adminUrl}" style="display:inline-block;background:#00A9C5;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;">
            Open admin-paneel →
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;" />
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
          letsgo radar — Automatisch dagrapport · 
          <a href="${baseUrl}/admin" style="color:#9ca3af;">Admin</a>
        </p>
      </div>
    </div>
  `;

  const transport = getTransporter();

  if (!transport) {
    console.log("\n========================================");
    console.log("[Email] DAGELIJKS DIGEST (dev mode — SMTP niet geconfigureerd)");
    console.log(`Datum: ${dateLabel}`);
    console.log(`Feeds totaal: ${allFeeds.length} | Actief: ${activeFeeds.length} | Probleem: ${problemFeeds.length}`);
    console.log(`Nieuwe events (24h): ${newEvents.length}`);
    console.log("========================================\n");
    return true;
  }

  try {
    await transport.sendMail({
      from: `letsgo radar <${getFromAddress()}>`,
      to: adminEmail,
      replyTo: adminEmail,
      subject,
      html,
      headers: {
        "List-Unsubscribe": `<mailto:${adminEmail}?subject=Unsubscribe>`,
        "X-Mailer": "letsgo-radar-digest/1.0",
        "Precedence": "bulk",
      },
    });
    console.log(`[Email] Dagelijkse digest verzonden naar ${adminEmail} (${allFeeds.length} feeds, ${newEvents.length} nieuwe events)`);
    return true;
  } catch (error) {
    console.error("[Email] Fout bij verzenden dagelijkse digest:", error);
    return false;
  }
}
