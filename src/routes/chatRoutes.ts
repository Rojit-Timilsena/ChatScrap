import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { validateSendMessage, validateHistoryQuery } from '../middleware/requestValidator';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const chatController = new ChatController();

// POST /api/chat/send - Send message to AI
router.post('/send', 
  validateSendMessage,
  asyncHandler(chatController.sendMessage.bind(chatController))
);

// GET /api/chat/history - Retrieve chat history
router.get('/history',
  validateHistoryQuery,
  asyncHandler(chatController.getHistory.bind(chatController))
);

// DELETE /api/chat/clear - Clear chat history
router.delete('/clear',
  asyncHandler(chatController.clearHistory.bind(chatController))
);

// GET /api/chat/providers - Get available providers
router.get('/providers',
  asyncHandler(chatController.getProviders.bind(chatController))
);

export { router as chatRoutes };