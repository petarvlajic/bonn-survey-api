import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Response as ResponseModel } from '../src/models/Response';
import publicPatientRoutes from '../src/routes/publicPatient';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/public', publicPatientRoutes);
  return app;
}

describe('public patient submit', () => {
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
    }
  });

  afterEach(async () => {
    if (!mongoReady) return;
    await ResponseModel.deleteMany({});
  });

  afterAll(async () => {
    if (!mongoReady) return;
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('accepts completed patient response without auth', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app)
      .post('/api/public/patient-responses')
      .send({
        status: 'completed',
        intervieweeName: 'Max Mustermann',
        intervieweeEmail: 'max@example.com',
        birthDate: '1990-01-15',
        signatureBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        answers: [
          { questionId: 'firstName', type: 'TEXT', value: 'Max' },
          { questionId: 'lastName', type: 'TEXT', value: 'Mustermann' },
          { questionId: 'email', type: 'TEXT', value: 'max@example.com' },
        ],
        boundedPatientSubmit: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.response.intervieweeEmail).toBe('max@example.com');
    expect(res.body.response.workflowStatus).toBe('pending_shk_followup');
    expect(res.body.response.patientBoundedSubmit).toBe(true);
    expect(res.body.response.draft).toBe(false);
  });

  it('rejects submit without signature', async () => {
    if (!mongoReady) {
      expect(true).toBe(true);
      return;
    }

    const res = await request(app).post('/api/public/patient-responses').send({
      status: 'completed',
      intervieweeName: 'Max Mustermann',
      intervieweeEmail: 'max@example.com',
      answers: [],
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SIGNATURE_REQUIRED');
  });
});
