import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Response as ResponseModel } from '../src/models/Response';
import { User } from '../src/models/User';

vi.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const userId = req.headers['x-user-id'] || new mongoose.Types.ObjectId().toString();
    req.user = { _id: String(userId), email: 'tester@ukbonn.de', profile: { firstName: 'Test', lastName: 'User' } };
    next();
  },
}));

const sendConsent = vi.fn(async () => undefined);
vi.mock('../src/utils/email', () => ({
  sendConsentEmailWithPdf: (...args: unknown[]) => sendConsent(...(args as [])),
  sendSurveyCompletionEmail: vi.fn(async () => undefined),
  sendPathologicalFindingReportEmail: vi.fn(async () => undefined),
}));
vi.mock('../src/utils/consentEmailPdf', () => ({
  buildFinalConsentEmailPdf: vi.fn(async () => Buffer.from('%PDF-fake')),
}));

import responsesRouter from '../src/routes/responses';
import { buildFinalConsentEmailPdf } from '../src/utils/consentEmailPdf';

describe('responses search + resend e-mail', () => {
  let mongoServer: MongoMemoryServer;
  let mongoReady = false;
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/responses', responsesRouter);
  const owner = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
      mongoReady = true;
    } catch {
      mongoReady = false;
    }
  });
  beforeEach(() => {
    sendConsent.mockClear();
    sendConsent.mockImplementation(async () => undefined);
  });
  afterEach(async () => {
    if (mongoReady) {
      await ResponseModel.deleteMany({});
      await User.deleteMany({});
    }
  });
  afterAll(async () => {
    if (!mongoReady) return;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const create = async (over: Record<string, unknown> = {}) => {
    const res = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [
          { questionId: 'firstName', type: 'TEXT', value: 'Stefan Petar' },
          { questionId: 'lastName', type: 'TEXT', value: 'Popović' },
        ],
        draft: false,
        status: 'completed',
        intervieweeName: 'Stefan Petar Popović',
        intervieweeEmail: 'stefan@example.com',
        birthDate: '1985-03-05',
        ...over,
      });
    expect(res.status).toBe(201);
    return res.body.response._id as string;
  };

  const search = async (q: string, extra = '') => {
    const res = await request(app).get(`/api/responses?search=${encodeURIComponent(q)}${extra}`).set('x-user-id', owner);
    expect(res.status).toBe(200);
    return res.body.responses.map((r: any) => r._id) as string[];
  };

  describe('GET /?search=', () => {
    it('finds by last name, by the second first name, by e-mail and by PID', async () => {
      if (!mongoReady) return;
      const id = await create();
      await create({ intervieweeName: 'Anna Meier', intervieweeEmail: 'anna@example.com',
        answers: [{ questionId: 'firstName', type: 'TEXT', value: 'Anna' }, { questionId: 'lastName', type: 'TEXT', value: 'Meier' }] });
      expect(await search('popović')).toEqual([id]);
      expect(await search('petar')).toEqual([id]);
      expect(await search('stefan@example')).toEqual([id]);
      expect(await search('meier')).toHaveLength(1);
    });

    it('requires all tokens (first + last name, any order)', async () => {
      if (!mongoReady) return;
      const id = await create();
      await create({ intervieweeName: 'Stefan Meier',
        answers: [{ questionId: 'firstName', type: 'TEXT', value: 'Stefan' }, { questionId: 'lastName', type: 'TEXT', value: 'Meier' }] });
      expect(await search('stefan popović')).toEqual([id]);
      expect(await search('popović stefan')).toEqual([id]);
    });

    it('finds by birth date typed as DD.MM.YYYY, D.M.YYYY, DD.MM. or year', async () => {
      if (!mongoReady) return;
      const id = await create();
      await create({ intervieweeName: 'Other Person', birthDate: '1990-07-01', answers: [] });
      expect(await search('05.03.1985')).toEqual([id]);
      expect(await search('5.3.1985')).toEqual([id]);
      expect(await search('1985-03-05')).toEqual([id]);
      expect(await search('05.03.')).toEqual([id]);
      expect(await search('1985')).toEqual([id]);
      expect(await search('popović 05.03.1985')).toEqual([id]);
      expect(await search('popović 01.07.1990')).toEqual([]);
    });

    it('does not crash on regex characters', async () => {
      if (!mongoReady) return;
      await create();
      expect(await search('((')).toEqual([]);
      expect(await search('.*')).toEqual([]);
    });

    it('combines with the pending/done bucket instead of replacing it', async () => {
      if (!mongoReady) return;
      const doneId = await create();
      const pendingId = await create({ patientBoundedSubmit: true, workflowStatus: 'pending_shk_followup' });
      const pending = await search('popović', '&workflowBucket=pending');
      expect(pending).toContain(pendingId);
      expect(pending).not.toContain(doneId);
    });

    it('finds by phone number and is case-insensitive', async () => {
      if (!mongoReady) return;
      const id = await create({ intervieweePhone: '+49 228 123456' });
      await create({ intervieweeName: 'Other', answers: [] });
      expect(await search('228 123456')).toEqual([id]); // two tokens, both inside the phone number
      expect(await search('POPOVIĆ')).toEqual([id]);
    });

    it('does not match arbitrary answer values (no noise from e.g. "Nein")', async () => {
      if (!mongoReady) return;
      await create({
        answers: [
          { questionId: 'firstName', type: 'TEXT', value: 'Stefan' },
          { questionId: 'lastName', type: 'TEXT', value: 'Popović' },
          { questionId: 'hasChestComplaints', type: 'SINGLE_CHOICE', value: 'Nein' },
          { questionId: 'familyDoctor', type: 'TEXT', value: 'Dr. Zimmermann' },
        ],
      });
      expect(await search('nein')).toEqual([]);
      expect(await search('zimmermann')).toEqual([]);
    });

    it('only uses the first 6 tokens', async () => {
      if (!mongoReady) return;
      const id = await create();
      expect(await search('stefan petar popović stefan petar popović nomatch')).toEqual([id]);
    });

    it('applies search and a day range together', async () => {
      if (!mongoReady) return;
      const id = await create();
      const otherDay = await create({ intervieweeName: 'Stefan Popović Zwei' });
      await ResponseModel.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(otherDay) },
        { $set: { createdAt: new Date('2020-01-01T12:00:00.000Z') } }
      );
      expect(await search('popović')).toHaveLength(2);
      const today = new Date().toISOString().slice(0, 10);
      const both = await search('popović', `&createdAtFrom=${today}&createdAtTo=${today}`);
      expect(both).toEqual([id]);
    });

    it('does not return soft-deleted reports', async () => {
      if (!mongoReady) return;
      const id = await create();
      await ResponseModel.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
      expect(await search('popović')).toEqual([]);
    });

    it('filters a single day in Berlin time, not UTC', async () => {
      if (!mongoReady) return;
      const id = await create();
      // 00:30 Berlin on 2026-07-15 == 22:30 UTC on the 14th
      await ResponseModel.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { createdAt: new Date('2026-07-14T22:30:00.000Z') } }
      );
      const onDay = await request(app).get('/api/responses?createdAtFrom=2026-07-15&createdAtTo=2026-07-15').set('x-user-id', owner);
      const dayBefore = await request(app).get('/api/responses?createdAtFrom=2026-07-14&createdAtTo=2026-07-14').set('x-user-id', owner);
      expect(onDay.body.responses.map((r: any) => r._id)).toEqual([id]);
      expect(dayBefore.body.responses).toHaveLength(0);
    });
  });

  describe('POST /:id/resend-email', () => {
    const resend = (id: string) => request(app).post(`/api/responses/${id}/resend-email`).set('x-user-id', owner);

    it('re-sends the consent PDF to the stored address and logs it', async () => {
      if (!mongoReady) return;
      const id = await create();
      const res = await resend(id);
      expect(res.status).toBe(200);
      expect(res.body.sentTo).toBe('stefan@example.com');
      expect(sendConsent).toHaveBeenCalledTimes(1);
      const args = sendConsent.mock.calls[0] as unknown as unknown[];
      expect(args[0]).toBe('stefan@example.com');
      expect(args[1]).toBe('Stefan Petar Popović');
      expect(Buffer.isBuffer(args[3])).toBe(true);
      const doc = await ResponseModel.findById(id);
      expect(doc!.changeLog.at(-1)!.reason).toContain('re-sent');
    });

    it('404 for unknown id', async () => {
      if (!mongoReady) return;
      const res = await resend(new mongoose.Types.ObjectId().toString());
      expect(res.status).toBe(404);
      expect(sendConsent).not.toHaveBeenCalled();
    });

    it('400 when no e-mail is stored', async () => {
      if (!mongoReady) return;
      const id = await create({ intervieweeEmail: '' });
      const res = await resend(id);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_EMAIL');
    });

    it('409 for drafts and for patient submits still waiting for the SHK follow-up', async () => {
      if (!mongoReady) return;
      const draftId = await create({ draft: true, status: 'draft' });
      expect((await resend(draftId)).body.code).toBe('RESPONSE_NOT_COMPLETED');
      const pendingId = await create({ patientBoundedSubmit: true, workflowStatus: 'pending_shk_followup' });
      const res = await resend(pendingId);
      expect(res.status).toBe(409);
      expect(sendConsent).not.toHaveBeenCalled();
    });

    it('also works for closed reports', async () => {
      if (!mongoReady) return;
      const id = await create({ workflowStatus: 'closed' });
      const res = await resend(id);
      expect(res.status).toBe(200);
      expect(sendConsent).toHaveBeenCalledTimes(1);
    });

    it('404 for soft-deleted reports', async () => {
      if (!mongoReady) return;
      const id = await create();
      await ResponseModel.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
      expect((await resend(id)).status).toBe(404);
      expect(sendConsent).not.toHaveBeenCalled();
    });

    it("builds the PDF with the re-sending SHK's examiner signature and name", async () => {
      if (!mongoReady) return;
      const shk = await User.create({
        email: 'shk@ukbonn.de',
        password: 'x'.repeat(12),
        profile: { firstName: 'Sabine', lastName: 'Schwarz', examinerSignatureBase64: 'data:image/png;base64,AAAA' },
      });
      const id = await create();
      const res = await request(app)
        .post(`/api/responses/${id}/resend-email`)
        .set('x-user-id', String(shk._id));
      expect(res.status).toBe(200);
      expect(vi.mocked(buildFinalConsentEmailPdf).mock.calls.at(-1)![1]).toMatchObject({
        examinerSignatureBase64: 'data:image/png;base64,AAAA',
        examinerName: 'Sabine Schwarz',
      });
    });

    it('502 when the mail provider fails, and nothing is logged', async () => {
      if (!mongoReady) return;
      const id = await create();
      sendConsent.mockImplementationOnce(async () => {
        throw new Error('smtp down');
      });
      const res = await resend(id);
      expect(res.status).toBe(502);
      expect(res.body.code).toBe('EMAIL_SEND_FAILED');
      const doc = await ResponseModel.findById(id);
      expect(doc!.changeLog.some((c) => c.reason?.includes('re-sent'))).toBe(false);
    });

    it('500 when the PDF cannot be built', async () => {
      if (!mongoReady) return;
      const id = await create();
      vi.mocked(buildFinalConsentEmailPdf).mockResolvedValueOnce(null);
      const res = await resend(id);
      expect(res.status).toBe(500);
      expect(sendConsent).not.toHaveBeenCalled();
    });
  });
});
