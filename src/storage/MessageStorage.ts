import { Message } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

export class MessageStorage {
  private messages: Message[] = [];

  addMessage(content: string, role: 'user' | 'assistant', provider?: string, error?: string): Message {
    const message: Message = {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date(),
      provider,
      error
    };

    this.messages.push(message);
    return message;
  }

  getMessages(limit?: number, offset?: number): Message[] {
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    
    return this.messages
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(start, end);
  }

  clearMessages(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }
}