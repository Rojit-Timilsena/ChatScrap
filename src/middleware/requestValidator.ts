import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Request size limits
const MAX_MESSAGE_LENGTH = 10000;
const MAX_PROVIDER_NAME_LENGTH = 100;

export const requestValidator = (req: Request, res: Response, next: NextFunction): void => {
  // Skip validation for health check and non-API routes
  if (req.path === '/health' || !req.path.startsWith('/api/')) {
    return next();
  }

  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new AppError(
        'Content-Type must be application/json',
        400,
        'INVALID_CONTENT_TYPE',
        { receivedContentType: contentType },
        ['Set Content-Type header to application/json']
      );
    }
  }

  // Validate request body size
  if (req.body && typeof req.body === 'object') {
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > 1024 * 1024) { // 1MB limit
      throw new AppError(
        'Request body too large',
        413,
        'PAYLOAD_TOO_LARGE',
        { maxSize: '1MB', receivedSize: `${Math.round(bodySize / 1024)}KB` },
        ['Reduce the size of your request payload']
      );
    }
  }

  next();
};

// Specific validation functions for different endpoints
export const validateSendMessage = (req: Request, res: Response, next: NextFunction): void => {
  const { message, provider } = req.body;

  const errors: string[] = [];

  // Validate message
  if (!message) {
    errors.push('Message is required');
  } else if (typeof message !== 'string') {
    errors.push('Message must be a string');
  } else if (message.trim().length === 0) {
    errors.push('Message cannot be empty');
  } else if (message.length > MAX_MESSAGE_LENGTH) {
    errors.push(`Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
  }

  // Validate provider (optional)
  if (provider !== undefined) {
    if (typeof provider !== 'string') {
      errors.push('Provider must be a string');
    } else if (provider.length > MAX_PROVIDER_NAME_LENGTH) {
      errors.push(`Provider name cannot exceed ${MAX_PROVIDER_NAME_LENGTH} characters`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR',
      { errors },
      ['Check the request format and field requirements']
    );
  }

  next();
};

export const validateHistoryQuery = (req: Request, res: Response, next: NextFunction): void => {
  const { limit, offset } = req.query;

  const errors: string[] = [];

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      errors.push('Limit must be a number between 1 and 1000');
    }
  }

  // Validate offset
  if (offset !== undefined) {
    const offsetNum = parseInt(offset as string, 10);
    if (isNaN(offsetNum) || offsetNum < 0) {
      errors.push('Offset must be a non-negative number');
    }
  }

  if (errors.length > 0) {
    throw new AppError(
      'Query validation failed',
      400,
      'VALIDATION_ERROR',
      { errors },
      ['Check the query parameters format']
    );
  }

  next();
};