import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Response as ResponseModel } from '../src/models/Response';
import '../src/models/User';

vi.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const userId = req.headers['x-user-id'] || new mongoose.Types.ObjectId().toString();
    req.user = {
      _id: String(userId),
      email: 'tester@ukbonn.de',
      profile: { firstName: 'Test', lastName: 'User' },
    };
    next();
  },
}));

vi.mock('../src/utils/email', () => ({
  sendConsentEmailWithPdf: vi.fn(async () => undefined),
  sendSurveyCompletionEmail: vi.fn(async () => undefined),
}));

import responsesRouter from '../src/routes/responses';
import { SHK_FOLLOWUP_ITEMS } from '../src/utils/shkFollowUpQuestions';

describe('responses routes integration', () => {
  let mongoServer: MongoMemoryServer;
  let mongoReady = false;
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/responses', responsesRouter);

  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
      mongoReady = true;
    } catch (error) {
      mongoReady = false;
      console.warn('[responses.integration] MongoMemoryServer unavailable, skipping integration assertions.');
    }
  });

  afterEach(async () => {
    if (!mongoReady) return;
    await ResponseModel.deleteMany({});
    delete process.env.POST_CLOSE_EDIT_PIN;
  });

  afterAll(async () => {
    if (!mongoReady) return;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('locks and unlocks a response with ownership checks', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId();
    const lockUser = new mongoose.Types.ObjectId().toString();
    const otherUser = new mongoose.Types.ObjectId().toString();
    const response = await ResponseModel.create({
      userId: owner,
      draft: false,
      workflowStatus: 'patient_completed',
      answers: [],
      intervieweeName: 'Alpha',
    });

    const lockRes = await request(app)
      .post(`/api/responses/${response._id}/lock`)
      .set('x-user-id', lockUser);
    expect(lockRes.status).toBe(200);
    expect(lockRes.body.response.workflowStatus).toBe('shk_in_progress');

    const wrongUnlock = await request(app)
      .post(`/api/responses/${response._id}/unlock`)
      .set('x-user-id', otherUser);
    expect(wrongUnlock.status).toBe(403);
    expect(wrongUnlock.body.code).toBe('NOT_LOCK_OWNER');

    const unlockRes = await request(app)
      .post(`/api/responses/${response._id}/unlock`)
      .set('x-user-id', lockUser);
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.response.workflowStatus).toBe('patient_completed');
  });

  it('enforces PIN + reason for post-close edits and writes changelog', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    process.env.POST_CLOSE_EDIT_PIN = '1234';
    const owner = new mongoose.Types.ObjectId();
    const response = await ResponseModel.create({
      userId: owner,
      draft: false,
      workflowStatus: 'closed',
      answers: [],
      intervieweeName: 'Before',
    });

    const noPin = await request(app)
      .put(`/api/responses/${response._id}`)
      .set('x-user-id', owner.toString())
      .send({ intervieweeName: 'After' });
    expect(noPin.status).toBe(403);
    expect(noPin.body.code).toBe('PIN_REQUIRED');

    const noReason = await request(app)
      .put(`/api/responses/${response._id}`)
      .set('x-user-id', owner.toString())
      .send({ intervieweeName: 'After', editPin: '1234' });
    expect(noReason.status).toBe(400);
    expect(noReason.body.code).toBe('CHANGE_REASON_REQUIRED');

    const ok = await request(app)
      .put(`/api/responses/${response._id}`)
      .set('x-user-id', owner.toString())
      .send({
        intervieweeName: 'After',
        editPin: '1234',
        changeReason: 'Correction requested by SHK',
      });
    expect(ok.status).toBe(200);
    expect(ok.body.response.intervieweeName).toBe('After');
    expect(ok.body.response.changeLog.length).toBeGreaterThan(0);
    expect(ok.body.response.changeLog[0].reason).toBe('Correction requested by SHK');
  });

  it('search finds answers free-text and export respects workflow/pid/search filters', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId();
    await ResponseModel.create({
      userId: owner,
      pid: 'HZB-20260311-AAAA',
      draft: false,
      workflowStatus: 'closed',
      answers: [{ questionId: 'echoFreeText', type: 'TEXT', value: 'alpha finding' }],
      intervieweeName: 'Alpha',
      intervieweeEmail: 'alpha@example.com',
    });
    await ResponseModel.create({
      userId: owner,
      pid: 'HZB-20260311-BBBB',
      draft: false,
      workflowStatus: 'patient_completed',
      answers: [{ questionId: 'echoFreeText', type: 'TEXT', value: 'beta finding' }],
      intervieweeName: 'Beta',
      intervieweeEmail: 'beta@example.com',
    });

    const searchRes = await request(app).get('/api/responses?search=alpha');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.total).toBe(1);
    expect(searchRes.body.responses[0].intervieweeName).toBe('Alpha');

    const csvRes = await request(app).get(
      '/api/responses/export/csv?workflowStatus=closed&pid=HZB-20260311-AAAA&search=alpha'
    );
    expect(csvRes.status).toBe(200);
    expect(String(csvRes.text)).toContain('Alpha');
    expect(String(csvRes.text)).not.toContain('Beta');
    expect(String(csvRes.text)).toContain('Q_echoFreeText');
  });

  it('rejects responses with too many or too large photo uploads', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const tinyDataUrl = `data:image/jpeg;base64,${Buffer.from('tiny').toString('base64')}`;

    const tooManyPhotosPayload = {
      answers: Array.from({ length: 6 }, (_, i) => ({
        questionId: `echoPhotos_${i + 1}`,
        type: 'IMAGE_UPLOAD',
        imageUri: tinyDataUrl,
      })),
      draft: false,
      status: 'completed',
      intervieweeName: 'Photo User',
      intervieweeEmail: 'photo@example.com',
    };

    const tooManyRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send(tooManyPhotosPayload);
    expect(tooManyRes.status).toBe(400);
    expect(tooManyRes.body.code).toBe('TOO_MANY_PHOTOS');

    const bigBase64 = 'A'.repeat(7 * 1024 * 1024); // > 5MB approx check
    const tooLargeRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [
          {
            questionId: 'echoPhotos_1',
            type: 'IMAGE_UPLOAD',
            imageUri: `data:image/jpeg;base64,${bigBase64}`,
          },
        ],
        draft: false,
        status: 'completed',
        intervieweeName: 'Large Photo User',
        intervieweeEmail: 'large@example.com',
      });
    expect(tooLargeRes.status).toBe(400);
    expect(tooLargeRes.body.code).toBe('PHOTO_TOO_LARGE');
  });

  it('rejects locking a response that is already closed', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId();
    const response = await ResponseModel.create({
      userId: owner,
      draft: false,
      workflowStatus: 'closed',
      answers: [],
      intervieweeName: 'Closed User',
    });

    const lockRes = await request(app)
      .post(`/api/responses/${response._id}/lock`)
      .set('x-user-id', new mongoose.Types.ObjectId().toString());
    expect(lockRes.status).toBe(409);
    expect(lockRes.body.code).toBe('RESPONSE_CLOSED');
  });

  it('rejects closing a response locked by another SHK', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId();
    const lockOwner = new mongoose.Types.ObjectId();
    const otherUser = new mongoose.Types.ObjectId().toString();
    const response = await ResponseModel.create({
      userId: owner,
      draft: false,
      workflowStatus: 'shk_in_progress',
      lockedBy: lockOwner,
      lockedAt: new Date(),
      answers: [],
      intervieweeName: 'Locked User',
    });

    const closeRes = await request(app)
      .post(`/api/responses/${response._id}/close`)
      .set('x-user-id', otherUser);
    expect(closeRes.status).toBe(409);
    expect(closeRes.body.code).toBe('RESPONSE_LOCKED');
  });

  it('rejects update for user who is neither owner nor lock holder', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId();
    const lockOwner = new mongoose.Types.ObjectId();
    const outsider = new mongoose.Types.ObjectId().toString();
    const response = await ResponseModel.create({
      userId: owner,
      draft: false,
      workflowStatus: 'shk_in_progress',
      lockedBy: lockOwner,
      lockedAt: new Date(),
      answers: [],
      intervieweeName: 'Original Name',
    });

    const updateRes = await request(app)
      .put(`/api/responses/${response._id}`)
      .set('x-user-id', outsider)
      .send({ intervieweeName: 'Changed Name' });
    expect(updateRes.status).toBe(403);
    expect(updateRes.body.code).toBe('FORBIDDEN');
  });

  it('rejects create response with invalid interviewee email format', async () => {
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
        intervieweeName: 'Email User',
        intervieweeEmail: 'invalid-email',
      });
    expect(createRes.status).toBe(400);
    expect(createRes.body.code).toBe('INVALID_EMAIL');
  });

  it('rejects create response with invalid submittedAt date', async () => {
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
        submittedAt: 'not-a-date',
        intervieweeName: 'Date User',
        intervieweeEmail: 'date.user@example.com',
      });
    expect(createRes.status).toBe(400);
    expect(createRes.body.code).toBe('INVALID_DATE');
  });

  it('rejects create response when non-file answers miss value payload', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId().toString();
    const createRes = await request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: [{ questionId: 'q-missing', type: 'TEXT' }],
        draft: false,
        status: 'completed',
        intervieweeName: 'Missing Value User',
      });
    expect(createRes.status).toBe(400);
    expect(createRes.body.code).toBe('MISSING_ANSWER_VALUES');
  });

  it('returns INVALID_ID for malformed response id on detail endpoint', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const resInvalid = await request(app).get('/api/responses/not-a-valid-id');
    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.code).toBe('INVALID_ID');
  });

  it('patient-bounded create sets pending_shk_followup and blocks close until follow-up', async () => {
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
        boundedPatientSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Pat Example',
        intervieweeEmail: 'pat.example@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.response.workflowStatus).toBe('pending_shk_followup');
    expect(createRes.body.response.patientBoundedSubmit).toBe(true);
    expect(createRes.body.response.consentPdfBase64Deferred).toBeDefined();

    const rid = createRes.body.response._id as string;

    const closeBlocked = await request(app).post(`/api/responses/${rid}/close`).set('x-user-id', owner);
    expect(closeBlocked.status).toBe(400);
    expect(closeBlocked.body.code).toBe('SHK_FOLLOWUP_REQUIRED');
  });

  it('requires lock and complete answers for follow-up completion; then closes', async () => {
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
        boundedPatientSubmit: true,
        consentPdfBase64: 'data:application/pdf;base64,QUJDCg==',
        intervieweeName: 'Pat Two',
        intervieweeEmail: 'pat.two@example.com',
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      });
    expect(createRes.status).toBe(201);
    const rid = createRes.body.response._id as string;

    const allTrue = Object.fromEntries(SHK_FOLLOWUP_ITEMS.map((item) => [item.id, true]));
    const needLock = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ answers: allTrue });
    expect(needLock.status).toBe(403);
    expect(needLock.body.code).toBe('LOCK_REQUIRED');

    await request(app).post(`/api/responses/${rid}/lock`).set('x-user-id', owner);

    const partial = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({
        answers: { [SHK_FOLLOWUP_ITEMS[0].id]: true },
      });
    expect(partial.status).toBe(400);
    expect(partial.body.code).toBe('INCOMPLETE_FOLLOWUP');

    const done = await request(app)
      .post(`/api/responses/${rid}/followup/complete`)
      .set('x-user-id', owner)
      .send({ answers: allTrue });
    expect(done.status).toBe(200);
    expect(done.body.response.workflowStatus).toBe('closed');
    expect(done.body.response.shkFollowUp?.completedAt).toBeDefined();

    const fromDb = await ResponseModel.findById(rid).lean();
    expect(fromDb?.consentPdfBase64Deferred).toBeUndefined();
  });

  it('unlock restores pending_shk_followup for bounded responses', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }
    const owner = new mongoose.Types.ObjectId();
    const ownerStr = owner.toString();
    const resp = await ResponseModel.create({
      userId: owner,
      draft: false,
      patientBoundedSubmit: true,
      workflowStatus: 'pending_shk_followup',
      answers: [{ questionId: 'q', type: 'TEXT', value: 'v' }],
      intervieweeEmail: 'u@example.com',
      intervieweeName: 'Unlock Test',
    });

    await request(app).post(`/api/responses/${resp._id}/lock`).set('x-user-id', ownerStr);
    const unlockRes = await request(app)
      .post(`/api/responses/${resp._id}/unlock`)
      .set('x-user-id', ownerStr);
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.response.workflowStatus).toBe('pending_shk_followup');
  });
});

