import geminiService from './geminiService.js';
import ragService from './ragService.js';
import Content from '../models/Content.js';
import { AppError } from '../middleware/errorHandler.js';

class ChatbotService {
  async processMessage(userId, userMessage, contentIds = null) {
    try {

      if (!userMessage || userMessage.trim().length === 0) {
        throw new AppError('Message cannot be empty', 400);
      }

      console.log(`📨 Processing message for user ${userId}: "${userMessage.substring(0, 50)}..."`);

      // Retrieve relevant content from user's materials
      const retrievedContent = await ragService.retrieveRelevantContent(userId, userMessage);
      console.log(`📚 Retrieved ${retrievedContent.length} relevant content items`);

      // Create context from retrieved content
      const context = ragService.createContext(retrievedContent);

      // Build prompt for Gemini
      const systemPrompt = `You are a helpful study assistant chatbot. You help students understand their study materials.
      
Guidelines:
- Answer questions based on the provided study materials
- Be concise and clear
- Use examples when helpful
- If information is not in the materials, say so
- Encourage deeper learning
- Keep responses to 2-3 paragraphs max`;

      const userPrompt = `${context}

Student Question: ${userMessage}

Please answer the question based on the provided materials. If the answer is not in the materials, provide a general explanation but mention that it's not from their materials.`;

      // Get response from Gemini
      console.log('🤖 Calling geminiService.generateContent...');
      const response = await geminiService.generateContent(userPrompt, systemPrompt);
      console.log('✅ Got response from geminiService');

      // Extract topics from response
      const topics = ragService.extractTopicsFromResponse(response);
      console.log(`🏷️ Extracted topics: ${topics.join(', ')}`);

      // Generate suggested follow-up questions
      const suggestedQuestions = ragService.generateSuggestedQuestions(
        userMessage,
        response,
        topics
      );

      // Prepare sources
      const sources = retrievedContent.map(content => ({
        id: content.id,
        title: content.title,
        type: content.type,
        relevanceScore: content.relevanceScore
      }));

      return {
        response,
        suggestedQuestions,
        sources,
        topics,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Chatbot processing error:', error);
      throw new AppError(error.message || 'Failed to process message', 500);
    }
  }

  /**
   * Generate quiz from conversation topics
   */
  async generateQuizFromChat(userId, conversationTopics, contentId) {
    try {
      if (!conversationTopics || conversationTopics.length === 0) {
        throw new AppError('No topics to generate quiz from', 400);
      }

      const systemPrompt = `You are an expert quiz generator. Create 5 multiple-choice questions based on the given topics.
      
Format your response as JSON array with this structure:
[
  {
    "question": "Question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Correct option text",
    "explanation": "Why this is correct",
    "topic": "Topic name"
  }
]`;

      const userPrompt = `Generate 5 quiz questions about these topics: ${conversationTopics.join(', ')}
      
Make questions progressively harder. Ensure they test understanding, not just memorization.`;

      const response = await geminiService.generateContent(userPrompt, systemPrompt);

      // Parse JSON response
      let questions = [];
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Failed to parse quiz JSON:', parseError);
        throw new AppError('Failed to generate quiz questions', 500);
      }

      return {
        questions,
        topicsCount: conversationTopics.length,
        difficulty: 'medium',
        generatedFrom: 'chat'
      };
    } catch (error) {
      console.error('Quiz generation error:', error);
      throw new AppError(error.message || 'Failed to generate quiz', 500);
    }
  }

  /**
   * Get learning recommendations based on chat history
   */
  async getLearningRecommendations(userId, recentTopics) {
    try {
      if (!recentTopics || recentTopics.length === 0) {
        return {
          recommendations: [],
          message: 'Start chatting to get personalized recommendations'
        };
      }

      const systemPrompt = `You are a learning advisor. Based on the topics discussed, provide 2-3 specific learning recommendations.
      
Format as JSON:
{
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "What to do",
      "action": "quiz|practice|review"
    }
  ]
}`;

      const userPrompt = `Based on these topics discussed: ${recentTopics.join(', ')}
      
What should the student focus on next? Provide actionable recommendations.`;

      const response = await geminiService.generateContent(userPrompt, systemPrompt);

      let recommendations = [];
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          recommendations = parsed.recommendations || [];
        }
      } catch (parseError) {
        console.error('Failed to parse recommendations:', parseError);
      }

      return {
        recommendations,
        topics: recentTopics
      };
    } catch (error) {
      console.error('Recommendations error:', error);
      return {
        recommendations: [],
        error: 'Failed to generate recommendations'
      };
    }
  }

  /**
   * Validate if user has content to chat about
   */
  async validateUserHasContent(userId) {
    try {
      const contentCount = await Content.countDocuments({ userId });
      return contentCount > 0;
    } catch (error) {
      console.error('Content validation error:', error);
      return false;
    }
  }
}

export default new ChatbotService();
