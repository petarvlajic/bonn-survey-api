import 'dotenv/config';
import { sendEmail } from '../src/utils/email';

const to = 'vlajic.p27@gmail.com';

sendEmail({
  to,
  subject: 'Test – Strato SMTP (UK Bonn Survey)',
  text: 'Ovo je testni mejl sa bekenda. Strato SMTP radi ispravno.',
  html: `
    <p>Ovo je <strong>testni mejl</strong> sa bekenda.</p>
    <p>Strato SMTP radi ispravno.</p>
    <p>— UK Bonn Survey API</p>
  `,
})
  .then(() => {
    console.log(`Test email sent to ${to}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
