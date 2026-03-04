# UK Bonn Survey API

A comprehensive backend API for managing surveys and interview responses, built with Express.js, TypeScript, and MongoDB.

## Features

- **User Authentication**: JWT-based authentication with email validation (@ukbonn.de)
- **Survey Management**: Create, read, update, and delete surveys with various question types
- **Response Management**: Track interview responses with draft/completed status
- **Admin Panel**: Web-based interface for viewing and managing responses
- **Export Functionality**: CSV and PDF export for responses
- **API Documentation**: Interactive Swagger UI for API exploration
- **Security**: Password hashing, rate limiting, CORS configuration

## Tech Stack

- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT tokens
- **Password Hashing**: bcrypt
- **PDF Generation**: PDFKit
- **API Documentation**: Swagger UI with OpenAPI 3.0

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:

- Set `MONGODB_URI` to your MongoDB connection string
- Set `JWT_SECRET` to a secure random string
- Configure `CORS_ORIGIN` for your frontend domain
- Configure email settings (SMTP) for sending survey PDFs (optional but recommended)

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## API Documentation

Interactive API documentation is available via Swagger UI:

```
http://localhost:3000/api-docs
```

The Swagger UI provides:

- Complete API endpoint documentation
- Request/response schemas
- Try-it-out functionality to test endpoints
- Authentication support (JWT Bearer token)

You can also access the OpenAPI JSON specification at:

```
http://localhost:3000/api-docs.json
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Users

- `GET /api/users/:userId/profile` - Get user profile
- `PUT /api/users/:userId/profile` - Update user profile

### Surveys

- `GET /api/surveys` - Get all surveys (with filters)
- `GET /api/surveys/:id` - Get survey by ID
- `POST /api/surveys` - Create a new survey
- `PUT /api/surveys/:id` - Update survey
- `DELETE /api/surveys/:id` - Delete survey

### Responses

- `GET /api/responses` - Get all responses (with pagination, filtering, sorting)
- `GET /api/responses/:id` - Get response by ID
- `POST /api/responses` - Create a new response
- `PUT /api/responses/:id` - Update response
- `DELETE /api/responses/:id` - Delete response
- `POST /api/responses/:id/complete` - Mark response as completed
- `GET /api/responses/export/csv` - Export responses as CSV
- `GET /api/responses/:id/export/pdf` - Export single response as PDF

### Drafts

- `GET /api/drafts` - Get all drafts
- `GET /api/drafts/:id` - Get draft by ID
- `POST /api/drafts` - Create a new draft
- `PUT /api/drafts/:id` - Update draft
- `DELETE /api/drafts/:id` - Delete draft

## Admin Panel

Access the web admin panel at:

```
http://localhost:3000/admin
```

Features:

- View all responses in a table format
- Filter by status, date range, interviewer
- Search by interviewee name/email
- Sort by any column
- Pagination
- View detailed response in modal
- Export individual responses as PDF
- Export all responses as CSV
- Bulk delete responses

## Question Types

Supported question types:

- `SINGLE_CHOICE` - Single selection from options
- `MULTIPLE_CHOICE` - Multiple selections from options
- `TEXT` - Text input
- `NUMBER` - Numeric input
- `RATING` - Rating scale
- `DATE` - Date picker
- `IMAGE_UPLOAD` - Image upload
- `FILE_UPLOAD` - File upload
- `GEOLOCATION` - Location coordinates
- `SIGNATURE` - Signature capture

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- JWT token authentication
- Rate limiting (100 requests per 15 minutes per IP)
- CORS configuration
- Input validation
- Email domain validation (@ukbonn.de)

## Database Models

### User

- Email (unique, must end with @ukbonn.de)
- Hashed password
- Profile (firstName, lastName, phone, avatar, position)

### Survey

- Title, description
- Questions array
- Repeatable sections
- Status (draft, active, completed, archived)
- Settings (allowAnonymous, requireSignature, etc.)

### Response

- Survey reference
- User reference (interviewer)
- Answers array
- Signature (base64)
- Draft/completed status
- Interviewee information

### Draft

- Survey reference
- User reference
- Partial response data

## Email Configuration

The API automatically sends a PDF copy of completed surveys to the interviewee's email address. To enable this feature, configure SMTP settings in your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@ukbonn.de
```

### Password reset email

When a user requests a password reset (`POST /api/auth/forgot-password`), the API sends an email with a reset link if SMTP is configured. Set the base URL of your app so the link points to the reset page:

```env
# URL where users open the reset link (web or app). Link will be: {RESET_PASSWORD_BASE_URL}/reset-password?token=...
RESET_PASSWORD_BASE_URL=https://survey.herz-check-bonn.de
# Or use FRONTEND_URL for the same purpose
# FRONTEND_URL=https://survey.herz-check-bonn.de
```

Without this, the email is still sent but the link may be missing or wrong. Reset tokens expire after 1 hour.

### Email Features

- **Automatic PDF Delivery**: When a survey is completed (draft: false), a PDF is automatically generated and sent to the `intervieweeEmail` field
- **Password reset**: Forgot-password sends an email with a reset link when SMTP is configured
- **Email Content**: Professional HTML email with survey details and PDF attachment
- **Error Handling**: Email failures are logged but don't prevent survey completion

### Supported SMTP Providers

- Gmail (requires App Password)
- Outlook/Office 365
- Custom SMTP servers
- Any SMTP-compatible email service

### Testing Email

For development, you can use services like:
- [Ethereal Email](https://ethereal.email) - Generates test SMTP credentials
- [Mailtrap](https://mailtrap.io) - Email testing service

### PDF Storage

PDF files are automatically saved to the `pdfs/` directory when surveys are completed. You can control this behavior with the `SAVE_PDF_TO_DISK` environment variable:

```env
# Save PDFs to disk (default: true)
SAVE_PDF_TO_DISK=true
```

**PDF Storage Location:**
- Directory: `./pdfs/` (in project root)
- Filename format: `response-{responseId}-{timestamp}.pdf`
- Example: `response-507f1f77bcf86cd799439011-1703001234567.pdf`

**Note:** The `pdfs/` directory is automatically created if it doesn't exist. Make sure to add it to `.gitignore` to avoid committing PDF files to version control.

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## License

ISC
