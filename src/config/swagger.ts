import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'UK Bonn Survey API',
    version: '1.0.0',
    description: 'A comprehensive API for managing surveys and interview responses',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: process.env.API_URL || 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'User ID',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email (must end with @ukbonn.de)',
          },
          profile: {
            type: 'object',
            properties: {
              firstName: {
                type: 'string',
              },
              lastName: {
                type: 'string',
              },
              phone: {
                type: 'string',
              },
              avatar: {
                type: 'string',
              },
              position: {
                type: 'string',
              },
            },
            required: ['firstName', 'lastName'],
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Survey: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
          },
          title: {
            type: 'string',
            required: true,
          },
          description: {
            type: 'string',
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                },
                type: {
                  type: 'string',
                  enum: [
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
                  ],
                },
                label: {
                  type: 'string',
                },
                required: {
                  type: 'boolean',
                },
                options: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'string',
                      },
                      label: {
                        type: 'string',
                      },
                    },
                  },
                },
                min: {
                  type: 'number',
                },
                max: {
                  type: 'number',
                },
                placeholder: {
                  type: 'string',
                },
                repeatable: {
                  type: 'boolean',
                },
              },
            },
          },
          repeatableSections: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
          createdBy: {
            type: 'string',
            description: 'User ID',
          },
          status: {
            type: 'string',
            enum: ['draft', 'active', 'completed', 'archived'],
          },
          settings: {
            type: 'object',
            properties: {
              allowAnonymous: {
                type: 'boolean',
              },
              requireSignature: {
                type: 'boolean',
              },
              minSignatureStrokeLength: {
                type: 'number',
              },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Response: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
          },
          userId: {
            type: 'string',
            description: 'Interviewer User ID',
          },
          answers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                questionId: {
                  type: 'string',
                },
                type: {
                  type: 'string',
                },
                value: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'array' },
                    {
                      type: 'object',
                      properties: {
                        lat: { type: 'number' },
                        lng: { type: 'number' },
                      },
                    },
                  ],
                },
                imageUri: {
                  type: 'string',
                },
                fileUri: {
                  type: 'string',
                },
                signatureBase64: {
                  type: 'string',
                },
              },
            },
          },
          signatureBase64: {
            type: 'string',
            description: 'Base64 encoded signature image',
          },
          draft: {
            type: 'boolean',
            default: true,
          },
          completedAt: {
            type: 'string',
            format: 'date-time',
          },
          intervieweeName: {
            type: 'string',
          },
          intervieweeEmail: {
            type: 'string',
            format: 'email',
          },
          intervieweePhone: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
          },
          code: {
            type: 'string',
          },
          details: {
            type: 'object',
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication endpoints',
    },
    {
      name: 'Users',
      description: 'User profile management',
    },
    {
      name: 'Surveys',
      description: 'Survey management',
    },
    {
      name: 'Responses',
      description: 'Response/interview record management',
    },
    {
      name: 'Drafts',
      description: 'Draft management',
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);

