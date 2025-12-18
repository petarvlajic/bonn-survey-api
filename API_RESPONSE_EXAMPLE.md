# API Response Example for Detail Page

This document shows the exact response structure you'll receive when fetching a single response by ID using `GET /api/responses/:id`.

## Response Structure

### Success Response (200 OK)

```json
{
  "response": {
    "_id": "692387cb56713b24ea86dbb1",
    "userId": {
      "_id": "69236f5ed00a3649564107d6",
      "email": "user@ukbonn.de",
      "profile": {
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+49 123 456789",
        "position": "Doctor"
      }
    },
    "answers": [
      {
        "questionId": "name",
        "type": "TEXT",
        "value": "Petar Vlajic"
      },
      {
        "questionId": "birthDate",
        "type": "DATE",
        "value": "2000-11-27"
      },
      {
        "questionId": "date",
        "type": "DATE",
        "value": "2025-11-25"
      },
      {
        "questionId": "hasChestComplaints",
        "type": "SINGLE_CHOICE",
        "value": "no"
      },
      {
        "questionId": "painIntensity",
        "type": "NUMBER",
        "value": 0
      },
      {
        "questionId": "accompanyingSymptoms",
        "type": "MULTIPLE_CHOICE",
        "value": [
          "Wassereinlagerungen (Beine, Knöchel, Bauch)",
          "Müdigkeit / Leistungsschwäche"
        ]
      },
      {
        "questionId": "breathlessnessOnExertion",
        "type": "SINGLE_CHOICE",
        "value": "no"
      },
      {
        "questionId": "swollenLegs",
        "type": "SINGLE_CHOICE",
        "value": "yes"
      },
      {
        "questionId": "valveTypes",
        "type": "MULTIPLE_CHOICE",
        "value": [
          "Aortenklappeninsuffizienz",
          "Mitralklappeninsuffizienz"
        ]
      },
      {
        "questionId": "heartDiseases",
        "type": "MULTIPLE_CHOICE",
        "value": [
          "Herzschwäche",
          "Herzinfarkt"
        ]
      }
    ],
    "signatureBase64": "Vlajic P",
    "draft": false,
    "completedAt": "2025-11-25T12:48:35.625Z",
    "intervieweeName": "Petar Vlajic",
    "intervieweeEmail": "",
    "intervieweePhone": "",
    "createdAt": "2025-11-25T12:48:35.625Z",
    "updatedAt": "2025-11-25T12:48:35.625Z"
  }
}
```

## Field Descriptions

### Top Level
- `response` - The response object containing all data

### Response Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `_id` | string | Response ID (MongoDB ObjectId) | `"692387cb56713b24ea86dbb1"` |
| `userId` | object | Interviewer/user who created the response | See below |
| `answers` | array | Array of answer objects | See below |
| `signatureBase64` | string \| null | Signature (text or base64 image) | `"Vlajic P"` or `"data:image/png;base64,..."` |
| `draft` | boolean | Whether response is a draft | `false` = completed, `true` = draft |
| `completedAt` | string \| null | ISO date when response was completed | `"2025-11-25T12:48:35.625Z"` |
| `intervieweeName` | string \| null | Name of the person being interviewed | `"Petar Vlajic"` |
| `intervieweeEmail` | string \| null | Email of interviewee | `"petar@example.com"` |
| `intervieweePhone` | string \| null | Phone of interviewee | `"+49 123 456789"` |
| `createdAt` | string | ISO date when response was created | `"2025-11-25T12:48:35.625Z"` |
| `updatedAt` | string | ISO date when response was last updated | `"2025-11-25T12:48:35.625Z"` |

### User Object (userId)

```json
{
  "_id": "69236f5ed00a3649564107d6",
  "email": "user@ukbonn.de",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+49 123 456789",
    "position": "Doctor",
    "avatar": "https://..."
  }
}
```

### Answer Object Structure

Each answer in the `answers` array has this structure:

```json
{
  "questionId": "name",           // Unique identifier for the question
  "type": "TEXT",                 // Question type (see types below)
  "value": "Petar Vlajic",        // The actual answer value
  "imageUri": "...",              // Optional: for IMAGE_UPLOAD type
  "fileUri": "...",               // Optional: for FILE_UPLOAD type
  "signatureBase64": "..."        // Optional: for SIGNATURE type
}
```

### Answer Value Types by Question Type

| Question Type | Value Type | Example |
|---------------|------------|---------|
| `TEXT` | string | `"Petar Vlajic"` |
| `DATE` | string (ISO date) | `"2000-11-27"` or `"2025-11-25"` |
| `NUMBER` | number | `0`, `5`, `10` |
| `SINGLE_CHOICE` | string | `"yes"`, `"no"`, `"option1"` |
| `MULTIPLE_CHOICE` | array of strings | `["option1", "option2"]` |
| `RATING` | number | `1`, `2`, `3`, `4`, `5` |
| `IMAGE_UPLOAD` | string (URL) \| null | `"https://..."` or `null` |
| `FILE_UPLOAD` | string (URL) \| null | `"https://..."` or `null` |
| `GEOLOCATION` | object | `{"lat": 50.7374, "lng": 7.0982}` |
| `SIGNATURE` | string \| null | `"John Doe"` or base64 image |

## Error Responses

### Response Not Found (404)

```json
{
  "error": "Response not found",
  "code": "RESPONSE_NOT_FOUND"
}
```

### Unauthorized (401)

```json
{
  "error": "Invalid token",
  "code": "INVALID_TOKEN"
}
```

## Frontend Usage Example

### TypeScript Interface

```typescript
interface Response {
  _id: string;
  userId: {
    _id: string;
    email: string;
    profile?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      position?: string;
      avatar?: string;
    };
  };
  answers: Answer[];
  signatureBase64?: string;
  draft: boolean;
  completedAt?: string;
  intervieweeName?: string;
  intervieweeEmail?: string;
  intervieweePhone?: string;
  createdAt: string;
  updatedAt: string;
}

interface Answer {
  questionId: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT' | 'NUMBER' | 'RATING' | 'DATE' | 'IMAGE_UPLOAD' | 'FILE_UPLOAD' | 'GEOLOCATION' | 'SIGNATURE';
  value: string | number | string[] | { lat: number; lng: number } | null;
  imageUri?: string;
  fileUri?: string;
  signatureBase64?: string;
}
```

### React Component Example

```typescript
import { useEffect, useState } from 'react';

function ResponseDetail({ responseId }: { responseId: string }) {
  const [response, setResponse] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/responses/${responseId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then(res => res.json())
      .then(data => {
        setResponse(data.response);
        setLoading(false);
      });
  }, [responseId]);

  if (loading) return <div>Loading...</div>;
  if (!response) return <div>Response not found</div>;

  return (
    <div>
      <h1>Response Details</h1>
      
      {/* Interviewee Info */}
      <div>
        <h2>Interviewee</h2>
        <p>Name: {response.intervieweeName || 'N/A'}</p>
        <p>Email: {response.intervieweeEmail || 'N/A'}</p>
        <p>Phone: {response.intervieweePhone || 'N/A'}</p>
      </div>

      {/* Interviewer Info */}
      <div>
        <h2>Interviewer</h2>
        <p>
          {response.userId.profile?.firstName} {response.userId.profile?.lastName}
        </p>
        <p>Email: {response.userId.email}</p>
      </div>

      {/* Status */}
      <div>
        <p>Status: {response.draft ? 'Draft' : 'Completed'}</p>
        {response.completedAt && (
          <p>Completed: {new Date(response.completedAt).toLocaleString()}</p>
        )}
      </div>

      {/* Answers */}
      <div>
        <h2>Answers</h2>
        {response.answers.map((answer) => (
          <div key={answer.questionId}>
            <h3>{answer.questionId}</h3>
            <p>Type: {answer.type}</p>
            {answer.type === 'MULTIPLE_CHOICE' && Array.isArray(answer.value) ? (
              <ul>
                {answer.value.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>Value: {String(answer.value)}</p>
            )}
          </div>
        ))}
      </div>

      {/* Signature */}
      {response.signatureBase64 && (
        <div>
          <h2>Signature</h2>
          {response.signatureBase64.startsWith('data:image') ? (
            <img src={response.signatureBase64} alt="Signature" />
          ) : (
            <p>{response.signatureBase64}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Helper Functions

### Get Answer by Question ID

```typescript
function getAnswerByQuestionId(response: Response, questionId: string): Answer | undefined {
  return response.answers.find(answer => answer.questionId === questionId);
}

// Usage
const nameAnswer = getAnswerByQuestionId(response, 'name');
const name = nameAnswer?.value as string;
```

### Format Answer Value for Display

```typescript
function formatAnswerValue(answer: Answer): string {
  if (answer.type === 'MULTIPLE_CHOICE' && Array.isArray(answer.value)) {
    return answer.value.join(', ');
  }
  if (answer.type === 'DATE' && typeof answer.value === 'string') {
    return new Date(answer.value).toLocaleDateString();
  }
  if (answer.type === 'GEOLOCATION' && typeof answer.value === 'object') {
    return `${answer.value.lat}, ${answer.value.lng}`;
  }
  return String(answer.value || 'N/A');
}
```

### Check if Response is Completed

```typescript
function isCompleted(response: Response): boolean {
  return !response.draft && response.completedAt != null;
}
```

## API Endpoint

```
GET /api/responses/:id
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/responses/692387cb56713b24ea86dbb1" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json"
```


