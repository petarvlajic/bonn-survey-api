import { Request, Response, NextFunction } from 'express';

interface RequestLog {
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

/**
 * Logger middleware - logs all incoming requests
 */
export const logger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Get client IP
  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown';

  const fullPath = req.originalUrl || req.path;

  // Log request start (full URL so you see /api/auth/register etc.)
  const logData: RequestLog = {
    timestamp,
    method: req.method,
    path: fullPath,
    ip: clientIp,
    userAgent: req.headers['user-agent'],
  };

  console.log(
    `[API] >>> ${logData.method} ${fullPath} (IP: ${logData.ip})`
  );

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    logData.statusCode = statusCode;
    logData.responseTime = responseTime;

    // Log response
    const statusEmoji =
      statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
    console.log(
      `[API] <<< ${statusEmoji} ${logData.method} ${fullPath} ${statusCode} ${responseTime}ms`
    );

    // Call original end and return the result
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Detailed logger for specific routes (like health check)
 */
export const detailedLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown';

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📥 REQUEST [${timestamp}]`);
  console.log(`   Method: ${req.method}`);
  console.log(`   Path: ${req.path}`);
  console.log(`   IP: ${clientIp}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'N/A'}`);
  console.log(`   Query:`, req.query);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📤 RESPONSE [${new Date().toISOString()}]`);
    console.log(`   Status: ${statusCode}`);
    console.log(`   Response Time: ${responseTime}ms`);
    const statusEmoji =
      statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
    console.log(
      `   ${statusEmoji} ${req.method} ${req.path} - ${statusCode} - ${responseTime}ms`
    );
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Call original end and return the result
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};
