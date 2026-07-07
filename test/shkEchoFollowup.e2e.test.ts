import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Response as ResponseModel } from '../src/models/Response';
import '../src/models/User';
import { generateResponsePDF } from '../src/utils/pdfGenerator';
import { validEchoScreeningFixture } from '../src/utils/shkEchoScreening';
import { SHK_FOLLOWUP_ITEMS } from '../src/utils/shkFollowUpQuestions';
import { PDFDocument } from 'pdf-lib';

const emailMocks = vi.hoisted(() => ({
  sendConsentEmailWithPdf: vi.fn(async () => undefined),
  sendSurveyCompletionEmail: vi.fn(async () => undefined),
  sendPathologicalFindingReportEmail: vi.fn(async () => undefined),
}));

vi.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const userId = req.headers['x-user-id'] || new mongoose.Types.ObjectId().toString();
    req.user = {
      _id: String(userId),
      email: 'shk-e2e@ukbonn.de',
      profile: { firstName: 'SHK', lastName: 'E2E' },
    };
    next();
  },
}));

vi.mock('../src/utils/email', () => ({
  sendConsentEmailWithPdf: emailMocks.sendConsentEmailWithPdf,
  sendSurveyCompletionEmail: emailMocks.sendSurveyCompletionEmail,
  sendPathologicalFindingReportEmail: emailMocks.sendPathologicalFindingReportEmail,
}));

import responsesRouter from '../src/routes/responses';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/responses', responsesRouter);
  return app;
}

describe('SHK echo follow-up (HTTP e2e)', () => {
  let mongoServer: MongoMemoryServer;
  let mongoReady = false;
  const app = buildApp();

  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
      mongoReady = true;
    } catch {
      mongoReady = false;
      console.warn('[shkEchoFollowup.e2e] MongoMemoryServer unavailable; tests will no-op.');
    }
  });

  afterEach(async () => {
    if (!mongoReady) return;
    await ResponseModel.deleteMany({});
    emailMocks.sendConsentEmailWithPdf.mockClear();
    emailMocks.sendSurveyCompletionEmail.mockClear();
    emailMocks.sendPathologicalFindingReportEmail.mockClear();
    delete process.env.SEND_SURVEY_COMPLETION_EMAIL;
  });

  afterAll(async () => {
    if (!mongoReady) return;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('returns INVALID_ID for malformed id on followup/complete', async () => {
    const res = await request(app).post('/api/responses/not-valid-id/followup/complete').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ID');
  });

  it('returns NOT_PATIENT_BOUNDED when response is not patient-bounded', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId();
    const ownerStr = owner.toString();
    const r = await ResponseModel.create({
      userId: owner,
      draft: false,
      patientBoundedSubmit: false,
      workflowStatus: 'patient_completed',
      answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
      intervieweeName: 'X',
    });
    await request(app).post(`/api/responses/${r._id}/lock`).set('x-user-id', ownerStr);
    const res = await request(app)
      .post(`/api/responses/${r._id}/followup/complete`)
      .set('x-user-id', ownerStr)
      .send({ echoScreening: validEchoScreeningFixture() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NOT_PATIENT_BOUNDED');
  });

  it('returns ECHO_SCREENING_REQUIRED when body omits echoScreening (including legacy answers)', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
        draft: false,
        status: 'completed',
        patientBoundedSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Echo Body',
        intervieweeEmail: 'echo.body@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    expect(createRes.status).toBe(201);
    const rid = createRes.body.response._id as string;
    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);

    const empty = await request(app).post(`/api/responses/${rid}/followup/complete`).set('x-user-id', owner).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('ECHO_SCREENING_REQUIRED');

    const legacy = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({
        answers: Object.fromEntries(SHK_FOLLOWUP_ITEMS.map((i) => [i.id, true])),
      });
    expect(legacy.status).toBe(400);
    expect(legacy.body.code).toBe('ECHO_SCREENING_REQUIRED');
  });

  it('returns ECHO_OVERALL_REQUIRED when overall is missing', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
        draft: false,
        status: 'completed',
        patientBoundedSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Overall Missing',
        intervieweeEmail: 'overall.missing@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    expect(createRes.status).toBe(201);
    const rid = createRes.body.response._id as string;
    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);
    const main = validEchoScreeningFixture().main;
    const res = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ echoScreening: { main, optional: {} } });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ECHO_OVERALL_REQUIRED');
  });

  it('returns FOLLOWUP_ALREADY_DONE on second complete', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
        draft: false,
        status: 'completed',
        patientBoundedSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Double',
        intervieweeEmail: 'double@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    const rid = createRes.body.response._id as string;
    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);
    const first = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ echoScreening: validEchoScreeningFixture() });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ echoScreening: validEchoScreeningFixture() });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe('FOLLOWUP_ALREADY_DONE');
  });

  it('persists optional Kurzcheck flags and overall needs_followup', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
        draft: false,
        status: 'completed',
        patientBoundedSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Kurz',
        intervieweeEmail: 'kurz@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    const rid = createRes.body.response._id as string;
    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);

    const payload = validEchoScreeningFixture();
    payload.main.mitral_valve = 'auffaellig';
    payload.optional.pericardial_effusion = true;
    payload.optional.rv_enlargement = true;
    payload.overall = 'needs_followup';

    const done = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ echoScreening: payload });
    expect(done.status).toBe(200);
    expect(done.body.response.shkFollowUp?.echoScreening?.optional?.pericardial_effusion).toBe(true);
    expect(done.body.response.shkFollowUp?.echoScreening?.optional?.rv_enlargement).toBe(true);
    expect(done.body.response.shkFollowUp?.echoScreening?.overall).toBe('needs_followup');
    expect(done.body.response.shkFollowUp?.echoScreening?.main?.mitral_valve).toBe('auffaellig');

    const getRes = await request(app).get(`/api/responses/${rid}`).set('x-user-id', owner);
    expect(getRes.status).toBe(200);
    expect(getRes.body.response.shkFollowUp?.echoScreening?.overall).toBe('needs_followup');
  });

  it('sends pathological finding report email when checkbox is set on followup/complete', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
        draft: false,
        status: 'completed',
        patientBoundedSubmit: true,
        pid: 'HZB-PATHO-01',
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Patho Echo Patient',
        intervieweeEmail: 'patho.echo@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    expect(createRes.status).toBe(201);
    const rid = createRes.body.response._id as string;
    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);

    const done = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({
        echoScreening: validEchoScreeningFixture(),
        pathologicalFindingReport: true,
      });

    expect(done.status).toBe(200);
    expect(done.body.response.pathologicalFindingReport).toBe(true);
    expect(emailMocks.sendPathologicalFindingReportEmail).toHaveBeenCalledTimes(1);
    const [pdfBuffer, meta] = emailMocks.sendPathologicalFindingReportEmail.mock.calls[0];
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect((pdfBuffer as Buffer).length).toBeGreaterThan(500);
    expect(meta).toEqual({
      pid: 'HZB-PATHO-01',
      intervieweeName: 'Patho Echo Patient',
    });
  });

  it('does not send pathological finding email when checkbox is omitted', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
        draft: false,
        status: 'completed',
        patientBoundedSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'No Patho',
        intervieweeEmail: 'no.patho@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    const rid = createRes.body.response._id as string;
    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);
    const done = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ echoScreening: validEchoScreeningFixture() });
    expect(done.status).toBe(200);
    expect(done.body.response.pathologicalFindingReport).toBeFalsy();
    expect(emailMocks.sendPathologicalFindingReportEmail).not.toHaveBeenCalled();
  });

  it('sends deferred consent email after successful follow-up', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q1', type: 'TEXT', value: 'x' }],
        draft: false,
        status: 'completed',
        patientBoundedSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Consent Echo',
        intervieweeEmail: 'consent.echo@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    const rid = createRes.body.response._id as string;
    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);
    const done = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ echoScreening: validEchoScreeningFixture() });
    expect(done.status).toBe(200);
    expect(emailMocks.sendConsentEmailWithPdf).toHaveBeenCalledTimes(1);
    expect(emailMocks.sendConsentEmailWithPdf.mock.calls[0][0]).toBe('consent.echo@example.com');
  });

  it('adds an extra PDF page when shkFollowUp.echoScreening is set (vs same response without)', async () => {
    const rid = new mongoose.Types.ObjectId();
    const base = {
      _id: rid,
      draft: false,
      createdAt: new Date(),
      completedAt: new Date(),
      intervieweeName: 'PDF Echo',
      intervieweeEmail: 'pdf.echo@example.com',
      userId: { email: 'inv@example.com', profile: { firstName: 'Inv', lastName: 'Estigator' } },
      answers: [],
      signatureBase64:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    };
    const withoutEcho = await generateResponsePDF(base, false);
    const withEcho = await generateResponsePDF(
      {
        ...base,
        shkFollowUp: {
          echoScreening: validEchoScreeningFixture(),
          completedAt: new Date(),
        },
      },
      false
    );
    expect(withoutEcho.length).toBeGreaterThan(2000);
    expect(withEcho.length).toBeGreaterThan(withoutEcho.length);
    const docNo = await PDFDocument.load(withoutEcho);
    const docYes = await PDFDocument.load(withEcho);
    expect(docYes.getPageCount()).toBe(docNo.getPageCount() + 1);
  });

  /**
   * Single end-to-end chain: tablet patient submission (bounded) → SHK locks record →
   * SHK completes Echo follow-up (closes case). Other tests in this file cover edge cases in isolation.
   */
  describe('Full combined flow (patient bounded → SHK lock → follow-up)', () => {
    it('chains POST create → pending_shk_followup → POST lock → POST followup/complete → closed', async () => {
      if (!mongoReady) {
        expect(true).toBe(true);
        return;
      }
      const owner = new mongoose.Types.ObjectId().toString();
      const tinyPng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

      const createRes = await request(app)
        .post('/api/responses')
        .set('x-user-id', owner)
        .send({
          answers: [{ questionId: 'chiefComplaint', type: 'TEXT', value: 'Bounded tablet interview (E2E chain).' }],
          draft: false,
          status: 'completed',
          patientBoundedSubmit: true,
          pid: 'HZB-E2E-FULL-01',
          birthDate: '1992-08-21',
          consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
          intervieweeName: 'E2E Chain Patient',
          intervieweeEmail: 'e2e.chain.patient@example.com',
          signature: tinyPng,
        });

      expect(createRes.status).toBe(201);
      const created = createRes.body.response;
      const rid = created._id as string;
      expect(created.patientBoundedSubmit).toBe(true);
      expect(created.workflowStatus).toBe('pending_shk_followup');
      expect(created.draft).toBe(false);

      const lockRes = await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);
      expect(lockRes.status).toBe(200);
      expect(lockRes.body.message).toBe('Response locked');
      expect(lockRes.body.response.workflowStatus).toBe('shk_in_progress');
      expect(lockRes.body.response.lockedBy).toBeTruthy();

      const echo = validEchoScreeningFixture();
      echo.main.aortic_valve = 'auffaellig';
      echo.optional.pericardial_effusion = true;
      echo.overall = 'needs_followup';

      const done = await request(app)
        .post(`/api/responses/${rid}/followup/complete`)
        .set('x-user-id', owner)
        .send({ echoScreening: echo });

      expect(done.status).toBe(200);
      expect(done.body.message).toMatch(/Follow-up completed/i);
      expect(done.body.response.workflowStatus).toBe('closed');
      expect(done.body.response.shkFollowUp?.echoScreening?.main?.aortic_valve).toBe('auffaellig');
      expect(done.body.response.shkFollowUp?.echoScreening?.optional?.pericardial_effusion).toBe(true);
      expect(done.body.response.shkFollowUp?.echoScreening?.overall).toBe('needs_followup');
      expect(done.body.response.shkFollowUp?.completedAt).toBeTruthy();

      const getRes = await request(app).get(`/api/responses/${rid}`).set('x-user-id', owner);
      expect(getRes.status).toBe(200);
      expect(getRes.body.response.workflowStatus).toBe('closed');
      expect(getRes.body.response.patientBoundedSubmit).toBe(true);
    });
  });
});
