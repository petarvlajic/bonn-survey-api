import mongoose from 'mongoose';
import { Response as ResponseModel } from '../models/Response';
import { generatePid } from '../utils/pid';

export type SubmitSurveyBody = Record<string, unknown>;

export type SubmitSurveyOptions = {
  userId: mongoose.Types.ObjectId | string;
  /** Force patient-bounded workflow (pending SHK follow-up, deferred consent email). */
  forceBoundedPatient?: boolean;
  /** Reject drafts — required for public kiosk submit. */
  requireCompleted?: boolean;
};

export type SubmitSurveyResult =
  | { ok: true; response: InstanceType<typeof ResponseModel> }
  | { ok: false; status: number; payload: Record<string, unknown> };

function parseAnswers(body: SubmitSurveyBody) {
  const answersArray =
    (body.answers as unknown[]) || (body.answer ? [body.answer] : []);

  return (answersArray as Record<string, unknown>[]).map((ans) => {
    const transformed: Record<string, unknown> = {
      questionId: ans.questionId,
      type: ans.type,
    };
    if (ans.answer !== undefined) transformed.value = ans.answer;
    else if (ans.value !== undefined) transformed.value = ans.value;
    if (ans.imageUri !== undefined) transformed.imageUri = ans.imageUri;
    if (ans.fileUri !== undefined) transformed.fileUri = ans.fileUri;
    if (ans.signatureBase64 !== undefined) transformed.signatureBase64 = ans.signatureBase64;
    return transformed;
  });
}

export async function submitSurveyResponseFromBody(
  body: SubmitSurveyBody,
  options: SubmitSurveyOptions
): Promise<SubmitSurveyResult> {
  const {
    pid,
    birthDate,
    consentPdfBase64,
    signatureBase64,
    signature,
    draft,
    status,
    intervieweeName,
    intervieweeEmail,
    intervieweePhone,
    submittedAt,
    boundedPatientSubmit,
  } = body;

  const transformedAnswers = parseAnswers(body);

  let finalDraft = draft;
  if (status === 'completed' || status === 'submitted') {
    finalDraft = false;
  } else if (draft === undefined) {
    finalDraft = true;
  }

  if (options.requireCompleted && finalDraft) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: 'Draft not allowed',
        code: 'DRAFT_NOT_ALLOWED',
        message: 'Please complete and submit the survey.',
      },
    };
  }

  let finalSignatureBase64 = signatureBase64 as string | undefined;
  if (!finalSignatureBase64 && signature) {
    finalSignatureBase64 =
      typeof signature === 'string' && signature.startsWith('data:')
        ? signature
        : (signature as string);
  }

  if (options.requireCompleted && !finalSignatureBase64) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: 'Signature required',
        code: 'SIGNATURE_REQUIRED',
        message: 'A signature is required to submit.',
      },
    };
  }

  const name = typeof intervieweeName === 'string' ? intervieweeName.trim() : '';
  const email = typeof intervieweeEmail === 'string' ? intervieweeEmail.trim() : '';
  if (options.requireCompleted && (!name || !email)) {
    return {
      ok: false,
      status: 400,
      payload: {
        error: 'Interviewee details required',
        code: 'MISSING_INTERVIEWEE',
        message: 'Name and email are required.',
      },
    };
  }

  let completedAt: Date | undefined;
  if ((status === 'completed' || status === 'submitted') && submittedAt) {
    completedAt = new Date(String(submittedAt));
    if (isNaN(completedAt.getTime())) {
      return {
        ok: false,
        status: 400,
        payload: {
          error: 'Invalid date format for submittedAt',
          code: 'INVALID_DATE',
        },
      };
    }
  } else if (options.requireCompleted) {
    completedAt = new Date();
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        ok: false,
        status: 400,
        payload: {
          error: 'Invalid email format',
          code: 'INVALID_EMAIL',
          field: 'intervieweeEmail',
        },
      };
    }
  }

  if (transformedAnswers.length > 0) {
    const imageUploadAnswers = transformedAnswers.filter(
      (a) => a.type === 'IMAGE_UPLOAD' && a.imageUri
    );
    if (imageUploadAnswers.length > 5) {
      return {
        ok: false,
        status: 400,
        payload: {
          error: 'Too many photos uploaded',
          code: 'TOO_MANY_PHOTOS',
        },
      };
    }
    const oversizedPhoto = imageUploadAnswers.find((a) => {
      const data = String(a.imageUri || '');
      const base64 = data.includes(',') ? data.split(',')[1] : data;
      const bytesApprox = Math.floor((base64.length * 3) / 4);
      return bytesApprox > 5 * 1024 * 1024;
    });
    if (oversizedPhoto) {
      return {
        ok: false,
        status: 400,
        payload: {
          error: 'Photo exceeds size limit',
          code: 'PHOTO_TOO_LARGE',
        },
      };
    }

    const answersWithoutValues = transformedAnswers.filter((answer) => {
      const hasValue =
        answer.value !== undefined && answer.value !== null && answer.value !== '';
      const hasImageUri = answer.imageUri != null;
      const hasFileUri = answer.fileUri != null;
      const hasSignatureBase64 = answer.signatureBase64 != null;
      const isFileType = ['IMAGE_UPLOAD', 'FILE_UPLOAD', 'SIGNATURE'].includes(
        String(answer.type)
      );
      if (isFileType && (hasImageUri || hasFileUri || hasSignatureBase64)) {
        return false;
      }
      return !hasValue;
    });

    if (answersWithoutValues.length > 0) {
      const questionIds = answersWithoutValues.map((a) => a.questionId).join(', ');
      return {
        ok: false,
        status: 400,
        payload: {
          error: 'Some answers are missing values',
          code: 'MISSING_ANSWER_VALUES',
          message: `Missing values for: ${questionIds}`,
        },
      };
    }
  }

  const effectivePid = (pid as string) || generatePid();
  const useBoundedPatientFlow =
    options.forceBoundedPatient ||
    (!finalDraft && (boundedPatientSubmit === true || boundedPatientSubmit === 'true'));

  const consentPdfBase64Deferred =
    useBoundedPatientFlow && consentPdfBase64 ? String(consentPdfBase64) : undefined;

  const initialWorkflow = finalDraft
    ? 'patient_in_progress'
    : useBoundedPatientFlow
      ? 'pending_shk_followup'
      : 'patient_completed';

  const response = new ResponseModel({
    userId: options.userId,
    pid: effectivePid,
    birthDate: birthDate as string | undefined,
    answers: transformedAnswers,
    signatureBase64: finalSignatureBase64,
    draft: finalDraft,
    completedAt,
    workflowStatus: initialWorkflow,
    patientBoundedSubmit: useBoundedPatientFlow,
    ...(consentPdfBase64Deferred ? { consentPdfBase64Deferred } : {}),
    intervieweeName: name || (intervieweeName as string | undefined),
    intervieweeEmail: email || (intervieweeEmail as string | undefined),
    intervieweePhone: intervieweePhone as string | undefined,
  });

  try {
    await response.save();
    await response.populate(
      'userId',
      'email profile.firstName profile.lastName profile.examinerSignatureBase64'
    );
    return { ok: true, response };
  } catch (saveError: unknown) {
    if (saveError instanceof Error && saveError.name === 'ValidationError') {
      const validationErrors = (saveError as { errors?: Record<string, { message?: string; path?: string }> })
        .errors || {};
      return {
        ok: false,
        status: 400,
        payload: {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: Object.values(validationErrors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        },
      };
    }
    throw saveError;
  }
}
