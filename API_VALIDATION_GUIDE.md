# API Validation Guide

This guide helps frontend developers understand and fix common validation errors when submitting survey responses.

## Common Validation Errors

### 1. Invalid Answer Type Enum Values

**Error:** `answers.X.type: 'string' is not a valid enum value for path 'type'`

**Problem:** The backend requires UPPERCASE enum values, not lowercase or JavaScript type names.

**Solution:** Use the exact enum values from the list below.

#### Valid Answer Types (UPPERCASE required)

- `SINGLE_CHOICE` - For radio button / single selection questions
- `MULTIPLE_CHOICE` - For checkbox / multiple selection questions
- `TEXT` - For text input fields
- `NUMBER` - For numeric input fields
- `RATING` - For rating scales
- `DATE` - For date pickers
- `IMAGE_UPLOAD` - For image upload fields
- `FILE_UPLOAD` - For file upload fields
- `GEOLOCATION` - For location/GPS fields
- `SIGNATURE` - For signature fields

#### Common Mappings (Frontend → Backend)

| Frontend Value | Backend Value       |
| -------------- | ------------------- |
| `"string"`     | `"TEXT"`            |
| `"text"`       | `"TEXT"`            |
| `"checkbox"`   | `"MULTIPLE_CHOICE"` |
| `"radio"`      | `"SINGLE_CHOICE"`   |
| `"date"`       | `"DATE"`            |
| `"number"`     | `"NUMBER"`          |
| `"signature"`  | `"SIGNATURE"`       |

#### Example Fix

**❌ Wrong:**

```json
{
  "questionId": "q1",
  "type": "string",
  "value": "John Doe"
}
```

**✅ Correct:**

```json
{
  "questionId": "q1",
  "type": "TEXT",
  "value": "John Doe"
}
```

**❌ Wrong:**

```json
{
  "questionId": "q2",
  "type": "checkbox",
  "value": ["option1", "option2"]
}
```

**✅ Correct:**

```json
{
  "questionId": "q2",
  "type": "MULTIPLE_CHOICE",
  "value": ["option1", "option2"]
}
```

### 2. Invalid Survey ID (Optional)

**Error:** `surveyId: Cast to ObjectId failed for value "your-actual-mongodb-objectid-here"`

**Problem:** Using a placeholder value instead of a real MongoDB ObjectId.

**Solution:**
The `surveyId` field is **optional**. If you don't provide it, the system will automatically use the single active survey.

**Option 1: Don't provide surveyId (Recommended for single survey apps)**

```typescript
const response = await fetch('/api/responses', {
  method: 'POST',
  body: JSON.stringify({
    // surveyId is optional - system will auto-select the active survey
    answers: [...]
  })
});
```

**Option 2: Provide a valid surveyId**

```typescript
// 1. Fetch surveys
const surveys = await fetch('/api/surveys');
const surveyData = await surveys.json();
const surveyId = surveyData.surveys[0]._id; // Use actual ID

// 2. Submit response with valid ID
const response = await fetch('/api/responses', {
  method: 'POST',
  body: JSON.stringify({
    surveyId: surveyId, // ✅ Valid 24-character hex string
    answers: [...]
  })
});
```

### 3. Complete Response Example

**With surveyId (optional):**

```json
{
  "surveyId": "507f1f77bcf86cd799439011",
  "answers": [
    {
      "questionId": "q1",
      "type": "TEXT",
      "value": "John Doe"
    },
    {
      "questionId": "q2",
      "type": "DATE",
      "value": "1990-01-01"
    },
    {
      "questionId": "q3",
      "type": "MULTIPLE_CHOICE",
      "value": ["option1", "option2"]
    },
    {
      "questionId": "q4",
      "type": "SINGLE_CHOICE",
      "value": "option1"
    },
    {
      "questionId": "q5",
      "type": "NUMBER",
      "value": 42
    },
    {
      "questionId": "q6",
      "type": "SIGNATURE",
      "value": "John Doe",
      "signatureBase64": "data:image/png;base64,iVBORw0KGgo..."
    }
  ],
  "draft": false,
  "intervieweeName": "Jane Smith",
  "intervieweeEmail": "jane@example.com",
  "intervieweePhone": "+1234567890"
}
```

**Without surveyId (auto-selects active survey):**

```json
{
  "answers": [
    {
      "questionId": "q1",
      "type": "TEXT",
      "value": "John Doe"
    },
    {
      "questionId": "q2",
      "type": "DATE",
      "value": "1990-01-01"
    }
  ],
  "draft": false,
  "intervieweeName": "Jane Smith",
  "intervieweeEmail": "jane@example.com",
  "intervieweePhone": "+1234567890"
}
```

## Frontend Helper Function

Use this function to normalize answer types:

```typescript
function normalizeAnswerType(type: string): string {
  const mapping: Record<string, string> = {
    string: 'TEXT',
    text: 'TEXT',
    checkbox: 'MULTIPLE_CHOICE',
    radio: 'SINGLE_CHOICE',
    date: 'DATE',
    number: 'NUMBER',
    rating: 'RATING',
    signature: 'SIGNATURE',
  };

  // If already uppercase and valid, return as-is
  if (
    [
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
    ].includes(type)
  ) {
    return type;
  }

  // Otherwise, try to map it
  return mapping[type.toLowerCase()] || type.toUpperCase();
}

// Usage
const answers = formData.map((answer) => ({
  ...answer,
  type: normalizeAnswerType(answer.type),
}));
```

## Best Practice: Use Survey Question Types Directly

The best approach is to use the `type` field directly from the survey questions:

```typescript
// When you fetch the survey
const survey = await fetch(`/api/surveys/${surveyId}`);
const surveyData = await survey.json();

// Use question.type directly (already correct from backend)
const answers = surveyData.questions.map((question) => ({
  questionId: question.id,
  type: question.type, // ✅ Already in correct format
  value: formData[question.id],
}));
```

## Error Response Format

When validation fails, the API returns:

```json
{
  "error": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "answers.0.type",
      "message": "`string` is not a valid enum value for path `type`.",
      "received": "string",
      "validValues": ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT", ...],
      "suggestion": "Did you mean \"TEXT\"? Common mappings: \"string\" -> \"TEXT\""
    }
  ],
  "hint": "The \"type\" field in answers must use UPPERCASE enum values...",
  "validAnswerTypes": ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT", ...]
}
```
