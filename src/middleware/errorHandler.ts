import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';
import mongoose from 'mongoose';

// Valid enum values for answer types
const VALID_ANSWER_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TEXT',
  'NUMBER',
  'RATING',
  'DATE',
  'IMAGE_UPLOAD',
  'FILE_UPLOAD',
  'GEOLOCATION',
  'SIGNATURE',
];

// Common enum value mappings (frontend -> backend)
const ENUM_VALUE_MAPPINGS: Record<string, string> = {
  string: 'TEXT',
  text: 'TEXT',
  checkbox: 'MULTIPLE_CHOICE',
  'multiple-choice': 'MULTIPLE_CHOICE',
  'multiple_choice': 'MULTIPLE_CHOICE',
  radio: 'SINGLE_CHOICE',
  'single-choice': 'SINGLE_CHOICE',
  'single_choice': 'SINGLE_CHOICE',
  number: 'NUMBER',
  rating: 'RATING',
  date: 'DATE',
  'image-upload': 'IMAGE_UPLOAD',
  'image_upload': 'IMAGE_UPLOAD',
  'file-upload': 'FILE_UPLOAD',
  'file_upload': 'FILE_UPLOAD',
  geolocation: 'GEOLOCATION',
  signature: 'SIGNATURE',
};

// Helper function to enhance error messages
const enhanceError = (error: any): any => {
  // Handle enum errors (for answer types)
  if (error.kind === 'enum' && error.path.includes('type')) {
    const invalidValue = error.value;
    const suggestedValue = ENUM_VALUE_MAPPINGS[invalidValue?.toLowerCase()];
    
    return {
      field: error.path,
      message: error.message,
      received: invalidValue,
      validValues: VALID_ANSWER_TYPES,
      ...(suggestedValue && {
        suggestion: `Did you mean "${suggestedValue}"? Common mappings: "${invalidValue}" -> "${suggestedValue}"`,
      }),
    };
  }
  
  // Handle CastErrors (invalid ObjectId) nested in ValidationError
  if (error.kind === 'ObjectId' || error.name === 'CastError') {
    const invalidValue = error.value;
    const isPlaceholder = typeof invalidValue === 'string' && 
      (invalidValue.includes('your-actual') || 
       invalidValue.includes('placeholder') ||
       invalidValue.includes('mongodb-objectid'));
    
    return {
      field: error.path,
      message: error.message,
      received: invalidValue,
      ...(isPlaceholder && {
        hint: 'You are using a placeholder value. Please provide a valid 24-character MongoDB ObjectId. Fetch a survey first using GET /api/surveys to get a real survey ID.',
        example: '507f1f77bcf86cd799439011',
      }),
      ...(!isPlaceholder && {
        hint: 'MongoDB ObjectId must be a 24-character hexadecimal string. Make sure you are using the _id field from a survey document.',
      }),
    };
  }
  
  // Default: return basic error info
  return {
    field: error.path,
    message: error.message,
  };
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let error: ApiError = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  };

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    const errors = Object.values(err.errors);
    const enumErrors = errors.filter((e: any) => e.kind === 'enum' && e.path.includes('type'));
    const castErrors = errors.filter((e: any) => e.kind === 'ObjectId' || e.name === 'CastError');
    const hasEnumErrors = enumErrors.length > 0;
    const hasCastErrors = castErrors.length > 0;
    
    error = {
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: errors.map((e: any) => enhanceError(e)),
      ...(hasEnumErrors && {
        hint: 'The "type" field in answers must use UPPERCASE enum values. Common mappings: "string" -> "TEXT", "checkbox" -> "MULTIPLE_CHOICE", "radio" -> "SINGLE_CHOICE"',
        validAnswerTypes: VALID_ANSWER_TYPES,
      }),
    };
  }
  // Mongoose duplicate key error
  else if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern)[0];
    error = {
      error: `${field} already exists`,
      code: 'DUPLICATE_KEY',
      details: { field },
    };
  }
  // Mongoose cast error (invalid ObjectId)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    const invalidValue = err.value;
    const isPlaceholder = typeof invalidValue === 'string' && 
      (invalidValue.includes('your-actual') || invalidValue.includes('placeholder'));
    
    error = {
      error: 'Invalid ID format',
      code: 'INVALID_ID',
      details: {
        field: err.path,
        received: invalidValue,
        ...(isPlaceholder && {
          hint: 'You are using a placeholder value. Please provide a valid 24-character MongoDB ObjectId (e.g., "507f1f77bcf86cd799439011")',
        }),
        ...(!isPlaceholder && {
          hint: 'MongoDB ObjectId must be a 24-character hexadecimal string',
        }),
      },
    };
  }
  // Custom API error
  else if (err.error) {
    statusCode = err.statusCode || 400;
    error = err;
  }
  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    error = {
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    };
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    error = {
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    };
  }
  // Default error
  else {
    error = {
      error: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
    };
  }

  // Improved logging - less verbose for validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    const errorCount = Object.keys(err.errors).length;
    const errorSummary = Object.values(err.errors)
      .slice(0, 3)
      .map((e: any) => `${e.path}: ${e.message}`)
      .join(', ');
    console.error(`[${statusCode}] Validation Error (${errorCount} errors):`, errorSummary);
    if (errorCount > 3) {
      console.error(`  ... and ${errorCount - 3} more error(s)`);
    }
  } else if (err instanceof mongoose.Error.CastError) {
    console.error(`[${statusCode}] Cast Error:`, err.path, '=', err.value);
  } else if (err.code === 11000) {
    console.error(`[${statusCode}] Duplicate Key Error:`, Object.keys(err.keyPattern)[0]);
  } else {
    // For other errors, log full details
    console.error(`[${statusCode}] Error:`, err.message || err);
  }

  res.status(statusCode).json(error);
};

