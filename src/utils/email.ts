import nodemailer from 'nodemailer';
import { encryptPdfBufferWithPassword } from './pdfEncrypt';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

// Create transporter based on environment variables (Strato: port 465 + SSL)
const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const useSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: useSecure,
      auth: process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: useSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send email with optional PDF attachment (SMTP).
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    console.log(`[API] [email] Connecting to SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT}) and sending to ${options.to}...`);
    const transporter = createTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ukbonn.de',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Build PDF password based on interviewee name and birth date.
 * Pattern: initials (first + last name) + birth year, e.g. "MM1985".
 */
const buildConsentPdfPassword = (
  intervieweeName?: string,
  birthDate?: string
): string | null => {
  if (!intervieweeName || !intervieweeName.trim()) return null;

  const parts = intervieweeName.trim().split(/\s+/);
  const first = parts[0]?.[0]?.toUpperCase() ?? '';
  const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '')?.toUpperCase() ?? '';
  const initials = `${first}${last}`.trim();

  if (!initials) return null;

  if (!birthDate) return null;
  const year = birthDate.split('-')[0];
  if (!/^\d{4}$/.test(year)) return null;

  return `${initials}${year}`;
};

function consentEmailPasswordHintDe(
  password: string | null
): string {
  if (password) {
    return (
      `Das angehängte PDF ist passwortgeschützt. Ihr Passwort lautet: <strong>${password}</strong> ` +
      '(Schema: Initialen von Vor- und Nachname plus Geburtsjahr, z. B. TT2000).'
    );
  }
  return (
    'Das angehängte PDF ist passwortgeschützt. Das Passwort setzt sich aus den Initialen ' +
    'Ihres Vor- und Nachnamens und Ihrem Geburtsjahr zusammen (z. B. TT2000).'
  );
}

function consentEmailPasswordHintDePlain(password: string | null): string {
  if (password) {
    return (
      `Das angehängte PDF ist passwortgeschützt. Ihr Passwort lautet: ${password} ` +
      '(Schema: Initialen von Vor- und Nachname plus Geburtsjahr, z. B. TT2000).'
    );
  }
  return (
    'Das angehängte PDF ist passwortgeschützt. Das Passwort setzt sich aus den Initialen ' +
    'Ihres Vor- und Nachnamens und Ihrem Geburtsjahr zusammen (z. B. TT2000).'
  );
}

function consentEmailPasswordHintEn(
  password: string | null
): string {
  if (password) {
    return (
      `The attached PDF is password-protected. Your password is: <strong>${password}</strong> ` +
      '(format: initials of first and last name plus year of birth, e.g. TT2000).'
    );
  }
  return (
    'The attached PDF is password-protected. The password is built from the initials of ' +
    'your first and last name and your year of birth (e.g. TT2000).'
  );
}

function consentEmailPasswordHintEnPlain(password: string | null): string {
  if (password) {
    return (
      `The attached PDF is password-protected. Your password is: ${password} ` +
      '(format: initials of first and last name plus year of birth, e.g. TT2000).'
    );
  }
  return (
    'The attached PDF is password-protected. The password is built from the initials of ' +
    'your first and last name and your year of birth (e.g. TT2000).'
  );
}

/**
 * Send survey completion email with PDF attachment
 */
export const sendSurveyCompletionEmail = async (
  recipientEmail: string,
  recipientName: string | undefined,
  pdfBuffer: Buffer,
  surveyTitle?: string
): Promise<void> => {
  const subject = surveyTitle
    ? `Your Survey Response: ${surveyTitle}`
    : 'Your Survey Response';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #4CAF50;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 0 0 5px 5px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Survey Completed Successfully</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName || 'Valued Participant'},</p>
          <p>Thank you for completing the survey${surveyTitle ? `: <strong>${surveyTitle}</strong>` : ''}.</p>
          <p>Please find attached a PDF copy of your survey response for your records.</p>
          <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
          <p>Best regards,<br>UK Bonn Survey Team</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Dear ${recipientName || 'Valued Participant'},
    
    Thank you for completing the survey${surveyTitle ? `: ${surveyTitle}` : ''}.
    
    Please find attached a PDF copy of your survey response for your records.
    
    If you have any questions or concerns, please don't hesitate to contact us.
    
    Best regards,
    UK Bonn Survey Team
  `;

  await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `survey-response-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
};

/**
 * Send consent PDF email (Datenschutzerklärung / Einwilligung) with optional password hint.
 * The PDF itself is currently sent as provided; the password pattern is documented in the email.
 */
export const sendConsentEmailWithPdf = async (
  recipientEmail: string,
  recipientName: string | undefined,
  birthDate: string | undefined,
  pdfBuffer: Buffer
): Promise<void> => {
  const password = buildConsentPdfPassword(recipientName, birthDate);

  // Try to encrypt PDF with password if possible; fall back to plain PDF on failure.
  const pdfToSend =
    password != null ? await encryptPdfBufferWithPassword(pdfBuffer, password) : pdfBuffer;

  const subject = 'Herz Check Bonn – Einwilligung';
  const nameDe = recipientName || 'Teilnehmer/in';
  const nameEn = recipientName || 'participant';

  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1976d2; color: white; padding: 16px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .lang-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; margin: 0 0 8px; }
        .divider { border: 0; border-top: 1px solid #ddd; margin: 28px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Einwilligung – Herz Check Bonn</h1>
        </div>
        <div class="content">
          <p class="lang-label">Deutsch</p>
          <p>Sehr geehrte/r ${nameDe},</p>
          <p>im Anhang finden Sie die „Patienteninformation und Einwilligungserklärung“ zum Forschungsprojekt Herz Check Bonn als PDF.</p>
          <p>${consentEmailPasswordHintDe(password)}</p>
          <p>Bitte bewahren Sie das Dokument für Ihre Unterlagen auf.</p>
          <p>Mit freundlichen Grüßen<br/>Ihr Herz-Check-Bonn-Team<br/>Universitätsklinikum Bonn</p>

          <hr class="divider" />

          <p class="lang-label">English</p>
          <p>Dear ${nameEn},</p>
          <p>Please find attached the patient information and declaration of consent for the Herz Check Bonn research project as a PDF.</p>
          <p>${consentEmailPasswordHintEn(password)}</p>
          <p>Please keep this document for your records.</p>
          <p>Kind regards,<br/>The Herz Check Bonn team<br/>University Hospital Bonn</p>
        </div>
        <div class="footer">
          <p>Dies ist eine automatisierte E-Mail. Bitte antworten Sie nicht auf diese Nachricht.<br/>
          This is an automated message. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Deutsch
──────
Sehr geehrte/r ${nameDe},

im Anhang finden Sie die „Patienteninformation und Einwilligungserklärung“ zum Forschungsprojekt Herz Check Bonn als PDF.

${consentEmailPasswordHintDePlain(password)}

Bitte bewahren Sie das Dokument für Ihre Unterlagen auf.

Mit freundlichen Grüßen
Ihr Herz-Check-Bonn-Team
Universitätsklinikum Bonn

English
───────
Dear ${nameEn},

Please find attached the patient information and declaration of consent for the Herz Check Bonn research project as a PDF.

${consentEmailPasswordHintEnPlain(password)}

Please keep this document for your records.

Kind regards
The Herz Check Bonn team
University Hospital Bonn
`.trim();

  await sendEmail({
    to: recipientEmail,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `einwilligung-herz-check-bonn-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfToSend,
        contentType: 'application/pdf',
      },
    ],
  });
};

/**
 * Send password reset email with link containing token.
 * RESET_PASSWORD_BASE_URL in env should be the app URL (e.g. https://survey.herz-check-bonn.de for web)
 * so the link is: {baseUrl}/reset-password?token=...
 */
export const sendPasswordResetEmail = async (to: string, resetToken: string): Promise<void> => {
  const scheme = (process.env.RESET_PASSWORD_APP_SCHEME || 'ukbonnsurvey').replace(/:\/\//, '');
  const appLink = `${scheme}://reset-password?token=${encodeURIComponent(resetToken)}`;
  const baseUrl = (process.env.RESET_PASSWORD_BASE_URL || process.env.FRONTEND_URL || '').replace(
    /\/$/,
    ''
  );
  const webLink = baseUrl
    ? `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`
    : null;

  const subject = 'Passwort zurücksetzen – Herz Check Bonn';
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <p>Guten Tag,</p>
        <p>Sie haben ein neues Passwort für Ihr Herz Check Bonn-Konto angefordert.</p>
        <p><a href="${appLink}" style="display: inline-block; padding: 10px 20px; background: #1976d2; color: #fff; text-decoration: none; border-radius: 5px;">Passwort zurücksetzen (App öffnen)</a></p>
        <p style="word-break: break-all; font-size: 13px; color: #555;">App-Link: ${appLink}</p>
        ${
          webLink
            ? `<p style="font-size: 13px; word-break: break-all;">Alternativ im Browser: <a href="${webLink}">${webLink}</a></p>`
            : ''
        }
        <p>Dieser Link ist 1 Stunde gültig.</p>
        <p>Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.</p>
        <p>Mit freundlichen Grüßen<br>Herz Check Bonn</p>
      </div>
    </body>
    </html>
  `;
  const text = [
    'Sie haben ein neues Passwort angefordert.',
    `App-Link (in der App öffnen): ${appLink}`,
    webLink ? `Browser: ${webLink}` : '',
    'Gültig für 1 Stunde.',
    'Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail.',
  ]
    .filter(Boolean)
    .join('\n\n');

  await sendEmail({ to, subject, text, html });
};


