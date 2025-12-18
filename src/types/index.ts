export type QuestionType = 
  | 'SINGLE_CHOICE' 
  | 'MULTIPLE_CHOICE' 
  | 'TEXT' 
  | 'NUMBER' 
  | 'RATING' 
  | 'DATE' 
  | 'IMAGE_UPLOAD' 
  | 'FILE_UPLOAD' 
  | 'GEOLOCATION' 
  | 'SIGNATURE';

export type SurveyStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: Array<{ id: string; label: string }>;
  min?: number;
  max?: number;
  placeholder?: string;
  repeatable?: boolean;
}

export interface RepeatableSection {
  id: string;
  title: string;
  questions: Question[];
  minRepeats?: number;
  maxRepeats?: number;
}

export interface SurveySettings {
  allowAnonymous?: boolean;
  requireSignature?: boolean;
  minSignatureStrokeLength?: number;
}

export interface Answer {
  questionId: string;
  type: QuestionType;
  value: string | number | string[] | number[] | { lat: number; lng: number } | null;
  imageUri?: string;
  fileUri?: string;
  signatureBase64?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: any;
}

