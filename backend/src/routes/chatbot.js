import express from 'express';
import { authenticate } from '../middleware/auth.js';
import chatbotService from '../services/chatbotService.js';
import ChatHistory from '../models/ChatHistory.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/message', authenticate, async (req, res, next) => {
  try {
    const { message, sessionId, contentId } = req.body;
    const userId = req.userId;

    if (!message || message.trim().length === 0) {
      throw new AppError('Message cannot be empty', 400);
    }

    const chatResponse = await chatbotService.processMessage(userId, message, contentId);

    let formattedSources = [];
    if (Array.isArray(chatResponse.sources) && chatResponse.sources.length > 0) {
      formattedSources = chatResponse.sources.map(source => ({
        contentId: source.id || null,
        title: String(source.title || ''),
        type: String(source.type || ''),
        relevanceScore: Number(source.relevanceScore || 0)
      }));
    }

    console.log('✅ Formatted sources:', JSON.stringify(formattedSources, null, 2));

    const assistantMessage = {
      role: 'assistant',
      content: chatResponse.response,
      suggestedQuestions: chatResponse.suggestedQuestions || [],
      topics: chatResponse.topics || []
    };

    if (formattedSources.length > 0) {
      assistantMessage.sources = formattedSources;
    }

    let chatSession;
    try {
      if (sessionId) {
        await ChatHistory.findByIdAndUpdate(
          sessionId,
          {
            $push: {
              messages: {
                role: 'user',
                content: message,
                timestamp: new Date()
              }
            },
            $inc: { totalMessages: 1 },
            updatedAt: new Date()
          },
          { new: true }
        );

        chatSession = await ChatHistory.findByIdAndUpdate(
          sessionId,
          {
            $push: {
              messages: assistantMessage
            },
            $inc: { totalMessages: 1 },
            $addToSet: { topicsDiscussed: { $each: chatResponse.topics || [] } },
            updatedAt: new Date()
          },
          { new: true }
        );
      } else {
        // Create new session
        chatSession = await ChatHistory.create({
          userId,
          sessionTitle: `Chat - ${new Date().toLocaleDateString()}`,
          messages: [
            {
              role: 'user',
              content: message,
              timestamp: new Date()
            },
            assistantMessage
          ],
          totalMessages: 2,
          topicsDiscussed: chatResponse.topics || []
        });
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      console.error('❌ Full error:', dbError);
      throw dbError;
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId: chatSession._id,
        response: chatResponse.response,
        suggestedQuestions: chatResponse.suggestedQuestions,
        sources: chatResponse.sources,
        topics: chatResponse.topics
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chatbot/history/:sessionId
 * Get chat history for a session
 */
router.get('/history/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;

    const chatSession = await ChatHistory.findOne({
      _id: sessionId,
      userId
    });

    if (!chatSession) {
      throw new AppError('Chat session not found', 404);
    }

    res.status(200).json({
      success: true,
      data: chatSession
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chatbot/sessions
 * Get all chat sessions for user
 */
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;
    const { limit = 10, skip = 0 } = req.query;

    const sessions = await ChatHistory.find({ userId })
      .select('_id sessionTitle totalMessages topicsDiscussed createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await ChatHistory.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: {
        sessions,
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chatbot/generate-quiz
 * Generate quiz from chat topics
 */
router.post('/generate-quiz', authenticate, async (req, res, next) => {
  try {
    const { topics, sessionId } = req.body;
    const userId = req.userId;

    if (!topics || topics.length === 0) {
      throw new AppError('Topics are required', 400);
    }

    // Generate quiz
    const quiz = await chatbotService.generateQuizFromChat(userId, topics);

    res.status(200).json({
      success: true,
      data: {
        ...quiz,
        sessionId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chatbot/recommendations
 * Get learning recommendations based on chat history
 */
router.get('/recommendations', authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;

    // Get recent chat topics
    const recentSession = await ChatHistory.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('topicsDiscussed');

    const topics = recentSession?.topicsDiscussed || [];

    // Get recommendations
    const recommendations = await chatbotService.getLearningRecommendations(userId, topics);

    res.status(200).json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chatbot/sessions/:sessionId
 * Delete a chat session
 */
router.delete('/sessions/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;

    const result = await ChatHistory.findOneAndDelete({
      _id: sessionId,
      userId
    });

    if (!result) {
      throw new AppError('Chat session not found', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Chat session deleted'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
