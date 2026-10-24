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

const answers = (location?: string) => [
  { questionId: 'q1', type: 'TEXT', value: 'x' },
  ...(location !== undefined ? [{ questionId: 'location', type: 'TEXT', value: location }] : []),
  { questionId: 'familyDoctor', type: 'TEXT', value: 'Dr. Meier' },
  { questionId: 'cardiologist', type: 'TEXT', value: 'Dr. Schmidt' },
];

describe('Standort / Hausarzt / Kardiologe on staff routes', () => {
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
    } catch {
      mongoReady = false;
    }
  });

  afterEach(async () => {
    if (mongoReady) await ResponseModel.deleteMany({});
  });

  afterAll(async () => {
    if (!mongoReady) return;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const create = (owner: string, location?: string) =>
    request(app)
      .post('/api/responses')
      .set('x-user-id', owner)
      .send({
        answers: answers(location),
        draft: true,
        intervieweeName: 'Loc User',
        intervieweeEmail: 'loc.user@example.com',
      });

  it('rejects an unknown location on create', async () => {
    if (!mongoReady) return;
    const res = await create(new mongoose.Types.ObjectId().toString(), 'Köln');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_LOCATION');
  });

  it('stores location, Hausarzt and Kardiologe answers on create', async () => {
    if (!mongoReady) return;
    const res = await create(new mongoose.Types.ObjectId().toString(), 'Brüser Berg');
    expect(res.status).toBe(201);
    const byId = Object.fromEntries(
      res.body.response.answers.map((a: any) => [a.questionId, a.value])
    );
    expect(byId.location).toBe('Brüser Berg');
    expect(byId.familyDoctor).toBe('Dr. Meier');
    expect(byId.cardiologist).toBe('Dr. Schmidt');
  });

  it('allows a draft without a location (only completed patient submits require it)', async () => {
    if (!mongoReady) return;
    const res = await create(new mongoose.Types.ObjectId().toString());
    expect(res.status).toBe(201);
  });

  it('validates location on update', async () => {
    if (!mongoReady) return;
    const owner = new mongoose.Types.ObjectId().toString();
    const created = await create(owner, 'Beuel');
    const id = created.body.response._id;

    const bad = await request(app)
      .put(`/api/responses/${id}`)
      .set('x-user-id', owner)
      .send({ answers: answers('Nowhere') });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_LOCATION');

    const ok = await request(app)
      .put(`/api/responses/${id}`)
      .set('x-user-id', owner)
      .send({ answers: answers('Endenich') });
    expect(ok.status).toBe(200);
    const loc = ok.body.response.answers.find((a: any) => a.questionId === 'location');
    expect(loc.value).toBe('Endenich');
  });
});
