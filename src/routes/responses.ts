import express, { Request, Response } from 'express';
import { Response as ResponseModel } from '../models/Response';
import { authenticate } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import { generateResponsePDF } from '../utils/pdfGenerator';
import { sendConsentEmailWithPdf, sendSurveyCompletionEmail } from '../utils/email';

const router = express.Router();

/**
 * @swagger
 * /api/responses:
 *   get:
 *     summary: Get all responses with pagination, filtering, and sorting
 *     tags: [Responses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: draft
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: completedAtFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: completedAtTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, completedAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of responses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 responses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Response'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      draft,
      completedAtFrom,
      completedAtTo,
      page = '1',
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const filter: any = {};

    // Allow filtering by userId if provided, otherwise show all responses
    if (userId) {
      filter.userId = userId;
    }

    if (draft !== undefined) {
      filter.draft = draft === 'true';
    }

    if (completedAtFrom || completedAtTo) {
      filter.completedAt = {};
      if (completedAtFrom) {
        filter.completedAt.$gte = new Date(completedAtFrom as string);
      }
      if (completedAtTo) {
        filter.completedAt.$lte = new Date(completedAtTo as string);
      }
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const [responses, total] = await Promise.all([
      ResponseModel.find(filter)
        .populate('userId', 'email profile.firstName profile.lastName')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      ResponseModel.countDocuments(filter),
    ]);

    res.json({
      responses,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/responses/{id}:
 *   get:
 *     summary: Get response by ID
 *     tags: [Responses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Response details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   $ref: '#/components/schemas/Response'
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Validate response ID format
    if (!req.params.id || req.params.id.length !== 24) {
      res.status(400).json({
        error: 'Invalid response ID',
        code: 'INVALID_ID',
        message: 'The response ID must be a valid 24-character identifier.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    const response = await ResponseModel.findById(req.params.id)
      .populate('userId', 'email profile.firstName profile.lastName');

    if (!response) {
      res.status(404).json({
        error: 'Response not found',
        code: 'RESPONSE_NOT_FOUND',
        message: 'The requested response does not exist.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    res.json({
      response,
    });
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/responses:
 *   post:
 *     summary: Create a new response
 *     tags: [Responses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               answers:
 *                 type: array
 *               signatureBase64:
 *                 type: string
 *               draft:
 *                 type: boolean
 *                 default: true
 *               intervieweeName:
 *                 type: string
 *               intervieweeEmail:
 *                 type: string
 *               intervieweePhone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Response created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   $ref: '#/components/schemas/Response'
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      answers,
      answer, // Support both plural and singular
      pid,
      birthDate,
      consentPdfBase64,
      signatureBase64,
      signature, // Support both signatureBase64 and signature
      draft,
      status, // Support status field (completed = draft: false)
      intervieweeName,
      intervieweeEmail,
      intervieweePhone,
      submittedAt, // Map to completedAt if status is completed
    } = req.body;

    // Use answers or answer (singular)
    const answersArray = answers || (answer ? [answer] : []);

    // Transform answers: map "answer" field to "value" field, remove extra fields
    const transformedAnswers = answersArray.map((ans: any) => {
      const transformed: any = {
        questionId: ans.questionId,
        type: ans.type,
      };

      // Map "answer" to "value" (support both field names)
      if (ans.answer !== undefined) {
        transformed.value = ans.answer;
      } else if (ans.value !== undefined) {
        transformed.value = ans.value;
      }

      // Keep optional fields if present
      if (ans.imageUri !== undefined) transformed.imageUri = ans.imageUri;
      if (ans.fileUri !== undefined) transformed.fileUri = ans.fileUri;
      if (ans.signatureBase64 !== undefined) transformed.signatureBase64 = ans.signatureBase64;

      return transformed;
    });

    // Determine draft status: if status is "completed", set draft to false
    let finalDraft = draft;
    if (status === 'completed' || status === 'submitted') {
      finalDraft = false;
    } else if (draft === undefined) {
      finalDraft = true; // Default to draft if not specified
    }

    // Map signature field to signatureBase64 if provided
    let finalSignatureBase64 = signatureBase64;
    if (!finalSignatureBase64 && signature) {
      // If signature is a string (text signature), we can store it
      // If it's base64, use it directly
      finalSignatureBase64 = typeof signature === 'string' && signature.startsWith('data:') 
        ? signature 
        : signature; // Store as-is, frontend can send base64 or text
    }

    // Set completedAt if status is completed and submittedAt is provided
    let completedAt: Date | undefined;
    if ((status === 'completed' || status === 'submitted') && submittedAt) {
      try {
        completedAt = new Date(submittedAt);
        if (isNaN(completedAt.getTime())) {
          res.status(400).json({
            error: 'Invalid date format for submittedAt',
            code: 'INVALID_DATE',
            message: 'The submittedAt field must be a valid date string (ISO 8601 format).',
            hint: 'Use format: YYYY-MM-DDTHH:mm:ss.sssZ (e.g., "2025-01-15T10:30:00.000Z")',
          });
          return;
        }
      } catch (dateError) {
        res.status(400).json({
          error: 'Invalid date format for submittedAt',
          code: 'INVALID_DATE',
          message: 'The submittedAt field must be a valid date string.',
          hint: 'Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ',
        });
        return;
      }
    }

    // Validate email format if provided
    if (intervieweeEmail !== undefined && intervieweeEmail !== null && intervieweeEmail !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(intervieweeEmail.trim())) {
        res.status(400).json({
          error: 'Invalid email format',
          code: 'INVALID_EMAIL',
          message: `The email address "${intervieweeEmail}" is not valid.`,
          hint: 'Please provide a valid email address (e.g., user@example.com)',
          field: 'intervieweeEmail',
        });
        return;
      }
    }

    // Validate that answers have values
    if (transformedAnswers && transformedAnswers.length > 0) {
      const answersWithoutValues = transformedAnswers.filter((answer: any) => {
        const hasValue = answer.value !== undefined && answer.value !== null && answer.value !== '';
        const hasImageUri = answer.imageUri != null;
        const hasFileUri = answer.fileUri != null;
        const hasSignatureBase64 = answer.signatureBase64 != null;
        const isFileType = ['IMAGE_UPLOAD', 'FILE_UPLOAD', 'SIGNATURE'].includes(answer.type);
        
        // For file types, allow if alternative field is provided
        if (isFileType && (hasImageUri || hasFileUri || hasSignatureBase64)) {
          return false;
        }
        
        return !hasValue;
      });

      if (answersWithoutValues.length > 0) {
        const questionIds = answersWithoutValues.map((a: any) => a.questionId).join(', ');
        res.status(400).json({
          error: 'Some answers are missing values',
          code: 'MISSING_ANSWER_VALUES',
          message: `Please provide answers for all questions. Missing values for: ${questionIds}`,
          details: answersWithoutValues.map((answer: any) => ({
            questionId: answer.questionId,
            type: answer.type,
            message: `Answer for question "${answer.questionId}" (type: ${answer.type}) is missing a value.`,
          })),
          hint: 'Each answer must have a "value" or "answer" field. For file uploads (IMAGE_UPLOAD, FILE_UPLOAD, SIGNATURE), use imageUri, fileUri, or signatureBase64 instead.',
        });
        return;
      }
    }

    const response = new ResponseModel({
      userId: req.user!._id,
      pid,
      birthDate,
      answers: transformedAnswers,
      signatureBase64: finalSignatureBase64,
      draft: finalDraft,
      completedAt,
      intervieweeName,
      intervieweeEmail,
      intervieweePhone,
    });

    try {
      await response.save();
      await response.populate('userId', 'email profile.firstName profile.lastName');

      // Send email with survey response PDF if survey is completed (not draft) and interviewee email is provided
      if (!finalDraft && response.intervieweeEmail) {
        try {
          const savePDF = process.env.SAVE_PDF_TO_DISK !== 'false';
          console.log(
            `[API] Generating PDF for response ${response._id} (saveToDisk=${savePDF})...`
          );
          const pdfBuffer = await generateResponsePDF(response, savePDF);
          console.log(
            `[API] PDF generated, size=${pdfBuffer.length} bytes. Sending email to ${response.intervieweeEmail}...`
          );
          await sendSurveyCompletionEmail(
            response.intervieweeEmail,
            response.intervieweeName,
            pdfBuffer
          );
          console.log(
            `[API] ✅ Email sent to ${response.intervieweeEmail} for response ${response._id}`
          );
        } catch (emailError: any) {
          console.error(
            `[API] ❌ Failed to send email to ${response.intervieweeEmail}:`,
            emailError.message
          );
          console.log(`[API] Request will still return 201 (email is optional).`);
        }
      } else {
        if (finalDraft) console.log(`[API] Skip email: response is draft.`);
        else if (!response.intervieweeEmail)
          console.log(`[API] Skip email: no intervieweeEmail.`);
      }

      // Send consent PDF email if client provided consentPdfBase64 (signed Datenschutzerklärung)
      if (!finalDraft && response.intervieweeEmail && consentPdfBase64) {
        try {
          const base64Part = consentPdfBase64.includes(',')
            ? consentPdfBase64.split(',')[1]
            : consentPdfBase64;
          const consentBuffer = Buffer.from(base64Part, 'base64');
          console.log(
            `[API] Sending consent PDF email to ${response.intervieweeEmail} for response ${response._id}...`
          );
          await sendConsentEmailWithPdf(
            response.intervieweeEmail,
            response.intervieweeName,
            response.birthDate,
            consentBuffer
          );
          console.log(
            `[API] ✅ Consent email sent to ${response.intervieweeEmail} for response ${response._id}`
          );
        } catch (consentError: any) {
          console.error(
            `[API] ❌ Failed to send consent email to ${response.intervieweeEmail}:`,
            consentError.message
          );
        }
      }

      console.log(`[API] Sending 201 response to client for response ${response._id}`);
      res.status(201).json({
        message: finalDraft 
          ? 'Response saved as draft successfully' 
          : 'Response submitted successfully',
        response,
      });
    } catch (saveError: any) {
      // Handle Mongoose validation errors (e.g., email validation)
      if (saveError instanceof Error && saveError.name === 'ValidationError') {
        const validationErrors = (saveError as any).errors || {};
        const errorFields = Object.keys(validationErrors);
        const firstError = validationErrors[errorFields[0]];
        
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          message: firstError?.message || 'Please check your input and try again.',
          details: Object.values(validationErrors).map((err: any) => ({
            field: err.path,
            message: err.message,
          })),
          hint: errorFields.includes('intervieweeEmail') 
            ? 'Please provide a valid email address (e.g., user@example.com)'
            : 'Please review the form and correct any errors.',
        });
        return;
      }
      throw saveError;
    }
  } catch (error) {
    throw error;
  }
});

// Update response
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Validate response ID format
    if (!req.params.id || req.params.id.length !== 24) {
      res.status(400).json({
        error: 'Invalid response ID',
        code: 'INVALID_ID',
        message: 'The response ID must be a valid 24-character identifier.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    const response = await ResponseModel.findById(req.params.id);

    if (!response) {
      res.status(404).json({
        error: 'Response not found',
        code: 'RESPONSE_NOT_FOUND',
        message: 'The response you are trying to update does not exist.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    // Check if user owns the response
    if (response.userId.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
        message: 'You can only update your own responses.',
        hint: 'Please use a response that belongs to your account.',
      });
      return;
    }

    const {
      answers,
      signatureBase64,
      draft,
      completedAt,
      intervieweeName,
      intervieweeEmail,
      intervieweePhone,
    } = req.body;

    // Validate email format if provided
    if (intervieweeEmail !== undefined && intervieweeEmail !== null && intervieweeEmail !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(intervieweeEmail.trim())) {
        res.status(400).json({
          error: 'Invalid email format',
          code: 'INVALID_EMAIL',
          message: `The email address "${intervieweeEmail}" is not valid.`,
          hint: 'Please provide a valid email address (e.g., user@example.com)',
          field: 'intervieweeEmail',
        });
        return;
      }
    }

    // Validate completedAt if provided
    if (completedAt !== undefined) {
      try {
        const date = new Date(completedAt);
        if (isNaN(date.getTime())) {
          res.status(400).json({
            error: 'Invalid date format',
            code: 'INVALID_DATE',
            message: 'The completedAt field must be a valid date string.',
            hint: 'Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ',
          });
          return;
        }
        response.completedAt = date;
      } catch (dateError) {
        res.status(400).json({
          error: 'Invalid date format',
          code: 'INVALID_DATE',
          message: 'The completedAt field must be a valid date string.',
          hint: 'Use ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ',
        });
        return;
      }
    }

    if (answers !== undefined) response.answers = answers;
    if (signatureBase64 !== undefined) response.signatureBase64 = signatureBase64;
    if (draft !== undefined) response.draft = draft;
    if (intervieweeName !== undefined) response.intervieweeName = intervieweeName;
    if (intervieweeEmail !== undefined) response.intervieweeEmail = intervieweeEmail;
    if (intervieweePhone !== undefined) response.intervieweePhone = intervieweePhone;

    try {
      await response.save();
      await response.populate('userId', 'email profile.firstName profile.lastName');

      res.json({
        message: 'Response updated successfully',
        response,
      });
    } catch (saveError: any) {
      // Handle Mongoose validation errors
      if (saveError instanceof Error && saveError.name === 'ValidationError') {
        const validationErrors = (saveError as any).errors || {};
        const firstError = Object.values(validationErrors)[0] as any;
        
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          message: firstError?.message || 'Please check your input and try again.',
          details: Object.values(validationErrors).map((err: any) => ({
            field: err.path,
            message: err.message,
          })),
        });
        return;
      }
      throw saveError;
    }
  } catch (error) {
    throw error;
  }
});

// Delete response
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    // Validate response ID format
    if (!req.params.id || req.params.id.length !== 24) {
      res.status(400).json({
        error: 'Invalid response ID',
        code: 'INVALID_ID',
        message: 'The response ID must be a valid 24-character identifier.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    const response = await ResponseModel.findById(req.params.id);

    if (!response) {
      res.status(404).json({
        error: 'Response not found',
        code: 'RESPONSE_NOT_FOUND',
        message: 'The response you are trying to delete does not exist.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    // Check if user owns the response
    if (response.userId.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
        message: 'You can only delete your own responses.',
        hint: 'Please use a response that belongs to your account.',
      });
      return;
    }

    await ResponseModel.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Response deleted successfully',
      code: 'DELETE_SUCCESS',
    });
  } catch (error) {
    throw error;
  }
});

// Complete response
router.post('/:id/complete', authenticate, async (req: Request, res: Response) => {
  try {
    // Validate response ID format
    if (!req.params.id || req.params.id.length !== 24) {
      res.status(400).json({
        error: 'Invalid response ID',
        code: 'INVALID_ID',
        message: 'The response ID must be a valid 24-character identifier.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    const response = await ResponseModel.findById(req.params.id);

    if (!response) {
      res.status(404).json({
        error: 'Response not found',
        code: 'RESPONSE_NOT_FOUND',
        message: 'The response you are trying to complete does not exist.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    // Check if user owns the response
    if (response.userId.toString() !== req.user!._id) {
      res.status(403).json({
        error: 'Access denied',
        code: 'FORBIDDEN',
        message: 'You can only complete your own responses.',
        hint: 'Please use a response that belongs to your account.',
      });
      return;
    }

    // Check if already completed
    if (!response.draft) {
      res.status(400).json({
        error: 'Response already completed',
        code: 'ALREADY_COMPLETED',
        message: 'This response has already been completed.',
        hint: 'You cannot complete a response that is already submitted.',
      });
      return;
    }

    const { signatureBase64 } = req.body;

    response.draft = false;
    response.completedAt = new Date();
    if (signatureBase64 !== undefined) {
      response.signatureBase64 = signatureBase64;
    }

    try {
      await response.save();
      await response.populate('userId', 'email profile.firstName profile.lastName');

      // Send email with PDF if interviewee email is provided
      if (response.intervieweeEmail) {
        try {
          const savePDF = process.env.SAVE_PDF_TO_DISK !== 'false';
          console.log(`[API] [complete] Generating PDF for response ${response._id} (saveToDisk=${savePDF})...`);
          const pdfBuffer = await generateResponsePDF(response, savePDF);
          console.log(`[API] [complete] PDF generated, size=${pdfBuffer.length} bytes. Sending email to ${response.intervieweeEmail}...`);
          await sendSurveyCompletionEmail(
            response.intervieweeEmail,
            response.intervieweeName,
            pdfBuffer
          );
          console.log(`[API] [complete] ✅ Email sent to ${response.intervieweeEmail} for response ${response._id}`);
        } catch (emailError: any) {
          console.error(`[API] [complete] ❌ Failed to send email to ${response.intervieweeEmail}:`, emailError.message);
          console.log(`[API] [complete] Request will still return 200 (email is optional).`);
        }
      } else {
        console.log(`[API] [complete] Skip email: no intervieweeEmail.`);
      }

      console.log(`[API] [complete] Sending 200 response to client for response ${response._id}`);
      res.json({
        message: 'Response completed successfully',
        response,
      });
    } catch (saveError: any) {
      // Handle Mongoose validation errors
      if (saveError instanceof Error && saveError.name === 'ValidationError') {
        const validationErrors = (saveError as any).errors || {};
        const firstError = Object.values(validationErrors)[0] as any;
        
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          message: firstError?.message || 'Please check your input and try again.',
          details: Object.values(validationErrors).map((err: any) => ({
            field: err.path,
            message: err.message,
          })),
        });
        return;
      }
      throw saveError;
    }
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/responses/export/csv:
 *   get:
 *     summary: Export responses as CSV
 *     tags: [Responses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: draft
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export/csv', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      draft,
      completedAtFrom,
      completedAtTo,
    } = req.query;

    const filter: any = {};

    // Allow filtering by userId if provided, otherwise show all responses
    if (userId) {
      filter.userId = userId;
    }

    if (draft !== undefined) {
      filter.draft = draft === 'true';
    }

    if (completedAtFrom || completedAtTo) {
      filter.completedAt = {};
      if (completedAtFrom) {
        filter.completedAt.$gte = new Date(completedAtFrom as string);
      }
      if (completedAtTo) {
        filter.completedAt.$lte = new Date(completedAtTo as string);
      }
    }

    const responses = await ResponseModel.find(filter)
      .populate('userId', 'email profile.firstName profile.lastName')
      .sort({ createdAt: -1 });

    // Generate CSV
    const headers = [
      'ID',
      'Interviewer Email',
      'Interviewer Name',
      'Interviewee Name',
      'Interviewee Email',
      'Interviewee Phone',
      'Status',
      'Created At',
      'Completed At',
      'Has Signature',
    ];

    const rows = responses.map((r) => [
      r._id.toString(),
      (r.userId as any)?.email || 'N/A',
      (r.userId as any)?.profile
        ? `${(r.userId as any).profile.firstName} ${(r.userId as any).profile.lastName}`
        : 'N/A',
      r.intervieweeName || '',
      r.intervieweeEmail || '',
      r.intervieweePhone || '',
      r.draft ? 'Draft' : 'Completed',
      r.createdAt.toISOString(),
      r.completedAt ? r.completedAt.toISOString() : '',
      r.signatureBase64 ? 'Yes' : 'No',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="survey-responses-${new Date().toISOString().split('T')[0]}.csv"`
    );
    res.send(csv);
  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/responses/{id}/export/pdf:
 *   get:
 *     summary: Export single response as PDF
 *     tags: [Responses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/:id/export/pdf', authenticate, async (req: Request, res: Response) => {
  try {
    // Validate response ID format
    if (!req.params.id || req.params.id.length !== 24) {
      res.status(400).json({
        error: 'Invalid response ID',
        code: 'INVALID_ID',
        message: 'The response ID must be a valid 24-character identifier.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    const response = await ResponseModel.findById(req.params.id)
      .populate('userId', 'email profile.firstName profile.lastName');

    if (!response) {
      res.status(404).json({
        error: 'Response not found',
        code: 'RESPONSE_NOT_FOUND',
        message: 'The response you are trying to export does not exist.',
        hint: 'Please check the response ID and try again.',
      });
      return;
    }

    // Generate PDF using utility function
    const pdfBuffer = await generateResponsePDF(response);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="response-${response._id}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    throw error;
  }
});

export default router;

