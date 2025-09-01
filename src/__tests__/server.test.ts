import request from 'supertest';
import app from '../index';

describe('Express Server Setup', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        version: expect.any(String)
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('Route /unknown-route not found'),
          suggestions: expect.any(Array)
        }
      });
    });

    it('should handle invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
          suggestions: expect.any(Array)
        }
      });
    });
  });

  describe('Request Validation Middleware', () => {
    it('should require application/json content-type for POST requests', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'text/plain')
        .send('test')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be application/json'
        }
      });
    });

    it('should validate message field in send endpoint', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            errors: expect.arrayContaining(['Message is required'])
          }
        }
      });
    });

    it('should validate message length', async () => {
      const longMessage = 'a'.repeat(10001);
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: longMessage })
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            errors: expect.arrayContaining([
              expect.stringContaining('Message cannot exceed 10000 characters')
            ])
          }
        }
      });
    });

    it('should validate history query parameters', async () => {
      const response = await request(app)
        .get('/api/chat/history?limit=invalid')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: {
            errors: expect.arrayContaining([
              'Limit must be a number between 1 and 1000'
            ])
          }
        }
      });
    });
  });

  describe('API Routes', () => {
    it('should have chat routes mounted and working', async () => {
      // These should return 200 (success) since we implemented the ChatController
      await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: 'test' })
        .expect(200);

      await request(app)
        .get('/api/chat/history')
        .expect(200);

      await request(app)
        .delete('/api/chat/clear')
        .expect(200);

      await request(app)
        .get('/api/chat/providers')
        .expect(200);
    });
  });
});