import nodemailer from 'nodemailer';

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
 * Send email with optional PDF attachment
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
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
 * Send password reset email with link containing token.
 * RESET_PASSWORD_BASE_URL in env should be the app URL (e.g. https://survey.herz-check-bonn.de for web)
 * so the link is: {baseUrl}/reset-password?token=...
 */
export const sendPasswordResetEmail = async (to: string, resetToken: string): Promise<void> => {
  const baseUrl = (process.env.RESET_PASSWORD_BASE_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const resetLink = baseUrl ? `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}` : null;

  const subject = 'Reset your password – UK Bonn Survey';
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <p>Hello,</p>
        <p>You requested a password reset for your UK Bonn Survey account.</p>
        ${
          resetLink
            ? `<p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background: #1976d2; color: #fff; text-decoration: none; border-radius: 5px;">Reset password</a></p>
        <p>Or copy this link into your browser:</p>
        <p style="word-break: break-all;">${resetLink}</p>
        <p>This link expires in 1 hour.</p>`
            : '<p>Use the reset token provided by the support team to set a new password in the app.</p>'
        }
        <p>If you did not request this, you can ignore this email.</p>
        <p>Best regards,<br>UK Bonn Survey Team</p>
      </div>
    </body>
    </html>
  `;
  const text = resetLink
    ? `Reset your password: ${resetLink}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`
    : 'You requested a password reset. Use the reset token in the app. If you did not request this, ignore this email.';

  await sendEmail({ to, subject, text, html });
};


