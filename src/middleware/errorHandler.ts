import { Request, Response, NextFunction } from 'express';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    suggestions?: string[];
  };
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;
  public suggestions?: string[];

  constructor(
    message: string, 
    statusCode: number = 500, 
    code: string = 'INTERNAL_ERROR',
    details?: any,
    suggestions?: string[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.suggestions = suggestions;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;
  let suggestions: string[] = [];

  // Handle custom AppError
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
    suggestions = error.suggestions || [];
  }
  // Handle validation errors
  else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
    suggestions = ['Check the request format and required fields'];
  }
  // Handle JSON parsing errors
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
    suggestions = ['Ensure the request body contains valid JSON'];
  }
  // Handle other known errors
  else if (error.message) {
    message = error.message;
  }

  // Log error details for debugging
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    statusCode,
    code,
    message,
    stack: error.stack,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Send error response
  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(suggestions.length > 0 && { suggestions })
    }
  };

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper utility
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};