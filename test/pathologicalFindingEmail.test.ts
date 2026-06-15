import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.hoisted(() =>
  vi.fn(async () => ({
    messageId: 'test-message-id',
    accepted: ['herzcheck.nachverfolgung@ukbonn.de'],
    rejected: [] as string[],
    response: '250 OK',
  }))
);

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: sendMailMock,
    }),
  },
}));

describe('sendPathologicalFindingReportEmail', () => {
  const originalInbox = process.env.PATHOLOGICAL_FINDING_EMAIL;

  beforeEach(() => {
    sendMailMock.mockClear();
    delete process.env.PATHOLOGICAL_FINDING_EMAIL;
  });

  afterEach(() => {
    if (originalInbox === undefined) {
      delete process.env.PATHOLOGICAL_FINDING_EMAIL;
    } else {
      process.env.PATHOLOGICAL_FINDING_EMAIL = originalInbox;
    }
  });

  it('sends PDF to default nachverfolgung inbox with patient meta', async () => {
    vi.resetModules();
    const { sendPathologicalFindingReportEmail } = await import('../src/utils/email');
    const pdf = Buffer.from('%PDF-1.4 pathological-test');

    await sendPathologicalFindingReportEmail(pdf, {
      pid: 'HZB-TEST-99',
      intervieweeName: 'Max Mustermann',
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mail = sendMailMock.mock.calls[0][0];
    expect(mail.to).toBe('herzcheck.nachverfolgung@ukbonn.de');
    expect(mail.subject).toContain('Kontrollbedürftiger / pathologischer Befund');
    expect(mail.subject).toContain('HZB-TEST-99');
    expect(mail.html).toContain('Max Mustermann');
    expect(mail.text).toContain('Max Mustermann');
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].content).toBe(pdf);
    expect(mail.attachments[0].contentType).toBe('application/pdf');
    expect(mail.attachments[0].filename).toMatch(/^herz-check-befund-HZB-TEST-99-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('uses PATHOLOGICAL_FINDING_EMAIL when set', async () => {
    process.env.PATHOLOGICAL_FINDING_EMAIL = 'test-inbox@example.com';
    vi.resetModules();
    const { sendPathologicalFindingReportEmail } = await import('../src/utils/email');

    await sendPathologicalFindingReportEmail(Buffer.from('x'), {
      intervieweeName: 'Test',
    });

    expect(sendMailMock.mock.calls[0][0].to).toBe('test-inbox@example.com');
  });
});
