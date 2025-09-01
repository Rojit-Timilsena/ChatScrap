import request from 'supertest';
import app from '../index';

describe('ChatController', () => {
  // Clear chat history before each test to ensure clean state
  beforeEach(async () => {
    await request(app).delete('/api/chat/clear');
  });

  describe('POST /api/chat/send', () => {
    it('should send a message and return both user and assistant messages', async () => {
      const testMessage = 'Hello, how are you?';
      
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: testMessage })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          userMessage: {
            id: expect.any(String),
            content: testMessage,
            role: 'user',
            timestamp: expect.any(String)
          },
          assistantMessage: {
            id: expect.any(String),
            content: expect.stringContaining('mock response'),
            role: 'assistant',
            timestamp: expect.any(String),
            provider: 'mock-provider'
          },
          totalMessages: 2
        }
      });
    });

    it('should send a message with specified provider', async () => {
      const testMessage = 'Test with provider';
      const testProvider = 'gpt-4';
      
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: testMessage, provider: testProvider })
        .expect(200);

      expect(response.body.data.assistantMessage.provider).toBe(testProvider);
    });

    it('should validate required message field', async () => {
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

    it('should validate empty message', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: '   ' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            errors: expect.arrayContaining(['Message cannot be empty'])
          }
        }
      });
    });
  });

  describe('GET /api/chat/history', () => {
    beforeEach(async () => {
      // Add some test messages
      await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: 'First message' });
      
      await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: 'Second message' });
    });

    it('should return chat history', async () => {
      const response = await request(app)
        .get('/api/chat/history')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          messages: expect.any(Array),
          pagination: {
            total: 4, // 2 user messages + 2 assistant messages
            limit: 4,
            offset: 0,
            hasMore: false
          }
        }
      });

      expect(response.body.data.messages).toHaveLength(4);
      expect(response.body.data.messages[0].content).toBe('First message');
      expect(response.body.data.messages[0].role).toBe('user');
    });

    it('should support pagination with limit', async () => {
      const response = await request(app)
        .get('/api/chat/history?limit=2')
        .expect(200);

      expect(response.body.data.messages).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        total: 4,
        limit: 2,
        offset: 0,
        hasMore: true
      });
    });

    it('should support pagination with offset', async () => {
      const response = await request(app)
        .get('/api/chat/history?limit=2&offset=2')
        .expect(200);

      expect(response.body.data.messages).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        total: 4,
        limit: 2,
        offset: 2,
        hasMore: false
      });
    });

    it('should validate limit parameter', async () => {
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

    it('should validate offset parameter', async () => {
      const response = await request(app)
        .get('/api/chat/history?offset=-1')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query validation failed',
          details: {
            errors: expect.arrayContaining([
              'Offset must be a non-negative number'
            ])
          }
        }
      });
    });

    it('should return empty history when no messages exist', async () => {
      // Clear history first
      await request(app).delete('/api/chat/clear');

      const response = await request(app)
        .get('/api/chat/history')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          messages: [],
          pagination: {
            total: 0,
            limit: 0,
            offset: 0,
            hasMore: false
          }
        }
      });
    });
  });

  describe('DELETE /api/chat/clear', () => {
    beforeEach(async () => {
      // Add some test messages
      await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send({ message: 'Test message' });
    });

    it('should clear chat history', async () => {
      const response = await request(app)
        .delete('/api/chat/clear')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Chat history cleared successfully',
          clearedMessageCount: 2 // 1 user + 1 assistant message
        }
      });

      // Verify history is actually cleared
      const historyResponse = await request(app)
        .get('/api/chat/history')
        .expect(200);

      expect(historyResponse.body.data.messages).toHaveLength(0);
      expect(historyResponse.body.data.pagination.total).toBe(0);
    });

    it('should handle clearing empty history', async () => {
      // Clear first
      await request(app).delete('/api/chat/clear');

      // Clear again
      const response = await request(app)
        .delete('/api/chat/clear')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Chat history cleared successfully',
          clearedMessageCount: 0
        }
      });
    });
  });

  describe('GET /api/chat/providers', () => {
    it('should return available providers', async () => {
      const response = await request(app)
        .get('/api/chat/providers')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          providers: expect.any(Array),
          availableCount: expect.any(Number),
          totalCount: expect.any(Number),
          note: expect.stringContaining('mock providers')
        }
      });

      expect(response.body.data.providers.length).toBeGreaterThan(0);
      
      // Check provider structure
      const provider = response.body.data.providers[0];
      expect(provider).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        status: expect.stringMatching(/^(available|unavailable|rate_limited)$/),
        lastChecked: expect.any(String),
        model: expect.any(String)
      });
    });

    it('should include provider statistics', async () => {
      const response = await request(app)
        .get('/api/chat/providers')
        .expect(200);

      const { providers, availableCount, totalCount } = response.body.data;
      
      expect(totalCount).toBe(providers.length);
      expect(availableCount).toBe(
        providers.filter((p: any) => p.status === 'available').length
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        }
      });
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/chat/send')
        .set('Content-Type', 'text/plain')
        .send('{"message": "test"}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be application/json'
        }
      });
    });
  });
});