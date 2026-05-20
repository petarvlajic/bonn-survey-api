/**
 * Build a sample stamped Einwilligung PDF and send it via the same SMTP as production.
 *
 * Usage:
 *   cd uk-bonn-survey-api && npx tsx scripts/send-test-consent-email.ts
 *   npx tsx scripts/send-test-consent-email.ts other@example.com
 *   DRY_RUN=1 npx tsx scripts/send-test-consent-email.ts   # only write test-output PDF
 *
 * Requires .env with SMTP_* (same as the running API).
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { buildFinalConsentEmailPdf } from '../src/utils/consentEmailPdf';
import { sendConsentEmailWithPdf } from '../src/utils/email';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const DEFAULT_TO = 'vlajic.p27@gmail.com';

async function main(): Promise<void> {
  const recipient = (process.argv[2] || process.env.TEST_CONSENT_EMAIL || DEFAULT_TO).trim();
  const dryRun = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M10 40 L190 40" stroke="black" stroke-width="3" fill="none"/></svg>`;
  const sig = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  const pdf = await buildFinalConsentEmailPdf(
    {
      intervieweeName: 'Anna Testpatientin',
      birthDate: '1990-05-15',
      signatureBase64: sig,
      answers: [
        { questionId: 'date', value: '2026-05-20' },
        {
          questionId: 'consentExplainedBy',
          value: 'Dr. med. Maria Aufklärerin (Test)',
        },
        {
          questionId: 'consentDiscussionPoints',
          value:
            'Testlauf: Freiwilligkeit, Widerruf, Datenverarbeitung, Risiken und Nutzen des Projekts.',
        },
      ],
    },
    { examinerSignatureBase64: sig }
  );

  if (!pdf) {
    console.error('buildFinalConsentEmailPdf returned null');
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'test-output');
  fs.mkdirSync(outDir, { recursive: true });
  const outfile = path.join(outDir, `consent-email-test-${Date.now()}.pdf`);
  fs.writeFileSync(outfile, pdf);
  console.log(`Wrote ${outfile} (${pdf.length} bytes)`);

  if (dryRun) {
    console.log('DRY_RUN=1: skip email');
    return;
  }

  await sendConsentEmailWithPdf(recipient, 'Anna Testpatientin', '1990-05-15', pdf);
  console.log(`Sent consent test email to ${recipient}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
