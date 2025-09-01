import { Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { MessageStorage } from '../storage/MessageStorage';
import { Message, Provider } from '@shared/types';

export class ChatController {
  private messageStorage: MessageStorage;

  constructor() {
    this.messageStorage = new MessageStorage();
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    const { message, provider } = req.body;

    try {
      // Add user message to storage
      const userMessage = this.messageStorage.addMessage(message, 'user');

      // For now, we'll create a mock AI response since G4FService isn't implemented yet
      // This will be replaced with actual G4F service call in subtask 4.3
      const mockResponse = `This is a mock response to: "${message}". The G4F service integration will be implemented in subtask 4.3.`;
      const assistantMessage = this.messageStorage.addMessage(
        mockResponse, 
        'assistant', 
        provider || 'mock-provider'
      );

      // Return both messages in the response
      res.status(200).json({
        success: true,
        data: {
          userMessage,
          assistantMessage,
          totalMessages: this.messageStorage.getMessageCount()
        }
      });
    } catch (error) {
      throw new AppError(
        'Failed to send message',
        500,
        'SEND_MESSAGE_ERROR',
        { originalError: error instanceof Error ? error.message : 'Unknown error' },
        ['Check the message format and try again']
      );
    }
  }

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

      const messages = this.messageStorage.getMessages(limit, offset);
      const totalCount = this.messageStorage.getMessageCount();
      const actualOffset = offset || 0;
      const actualLimit = limit || totalCount;

      res.status(200).json({
        success: true,
        data: {
          messages,
          pagination: {
            total: totalCount,
            limit: actualLimit,
            offset: actualOffset,
            hasMore: limit !== undefined ? 
              (actualOffset + actualLimit) < totalCount : false
          }
        }
      });
    } catch (error) {
      throw new AppError(
        'Failed to retrieve chat history',
        500,
        'GET_HISTORY_ERROR',
        { originalError: error instanceof Error ? error.message : 'Unknown error' },
        ['Try again or check server logs for details']
      );
    }
  }

  async clearHistory(req: Request, res: Response): Promise<void> {
    try {
      const messageCount = this.messageStorage.getMessageCount();
      this.messageStorage.clearMessages();

      res.status(200).json({
        success: true,
        data: {
          message: 'Chat history cleared successfully',
          clearedMessageCount: messageCount
        }
      });
    } catch (error) {
      throw new AppError(
        'Failed to clear chat history',
        500,
        'CLEAR_HISTORY_ERROR',
        { originalError: error instanceof Error ? error.message : 'Unknown error' },
        ['Try again or check server logs for details']
      );
    }
  }

  async getProviders(req: Request, res: Response): Promise<void> {
    try {
      // Mock providers for now - will be replaced with actual G4F providers in subtask 4.3
      const mockProviders: Provider[] = [
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          status: 'available',
          lastChecked: new Date(),
          model: 'gpt-3.5-turbo'
        },
        {
          id: 'gpt-4',
          name: 'GPT-4',
          status: 'available',
          lastChecked: new Date(),
          model: 'gpt-4'
        },
        {
          id: 'claude-2',
          name: 'Claude 2',
          status: 'rate_limited',
          lastChecked: new Date(),
          model: 'claude-2'
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          providers: mockProviders,
          availableCount: mockProviders.filter(p => p.status === 'available').length,
          totalCount: mockProviders.length,
          note: 'These are mock providers. Real G4F providers will be available in subtask 4.3.'
        }
      });
    } catch (error) {
      throw new AppError(
        'Failed to retrieve providers',
        500,
        'GET_PROVIDERS_ERROR',
        { originalError: error instanceof Error ? error.message : 'Unknown error' },
        ['Try again or check server logs for details']
      );
    }
  }
}