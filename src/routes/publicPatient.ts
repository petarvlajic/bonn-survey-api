import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { submitSurveyResponseFromBody } from '../services/submitSurveyResponse';
import { getPatientKioskUserId } from '../utils/patientKioskUser';

const router = express.Router();

const patientSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: 'Too many submissions from this device',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Anonymous patient tablet submit (no login).
 * Creates a bounded response awaiting SHK follow-up; consent email is deferred.
 */
router.post('/patient-responses', patientSubmitLimiter, async (req: Request, res: Response) => {
  try {
    const userId = await getPatientKioskUserId();
    const result = await submitSurveyResponseFromBody(req.body, {
      userId,
      forceBoundedPatient: true,
      requireCompleted: true,
    });

    if (!result.ok) {
      res.status(result.status).json(result.payload);
      return;
    }

    console.log(
      `[API] Public patient response ${result.response._id} pid=${result.response.pid} workflow=${result.response.workflowStatus}`
    );

    res.status(201).json({
      message: 'Response submitted successfully',
      response: result.response,
    });
  } catch (error) {
    throw error;
  }
});

export default router;
