import Flashcard from '../models/Flashcard.js';
import Content from '../models/Content.js';
import geminiService from './geminiService.js';
import { AppError } from '../middleware/errorHandler.js';
import axios from 'axios';

export class FlashcardService {
  async generateFlashcards(userId, contentId, count = 10) {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId) {
      throw new AppError('Content not found', 404);
    }

    // Check if flashcards already exist for this content
    const existingFlashcards = await Flashcard.find({ userId, contentId });
    if (existingFlashcards.length > 0) {
      // Return existing flashcards instead of throwing error
      return existingFlashcards;
    }

    // Generate flashcards using AI
    const flashcardsData = await this.generateFlashcardsWithAI(content.originalText, count);

    // Save flashcards to database
    const flashcards = await Flashcard.insertMany(
      flashcardsData.map(card => ({
        userId,
        contentId,
        front: card.front,
        back: card.back,
        topic: card.topic || content.topics?.[0] || 'General',
        difficulty: card.difficulty || 'medium',
        nextReview: new Date() // Available immediately
      }))
    );

    return flashcards;
  }

  async generateFlashcardsWithAI(text, count = 10) {
    try {
      const prompt = `Generate exactly ${count} flashcards from this text. Each flashcard should have:
- front: A question or term (concise, clear)
- back: The answer or definition (detailed but not too long)
- topic: The main topic this card covers
- difficulty: easy, medium, or hard

Return ONLY a valid JSON array, no other text. Example:
[{"front":"What is photosynthesis?","back":"The process by which plants convert light energy into chemical energy","topic":"Biology","difficulty":"easy"}]

Text: ${text.substring(0, 3000)}`;

      const responseText = await geminiService.generateContent(
        prompt,
        'You are an educational assistant that outputs only valid JSON arrays.'
      );
      
      // Parse JSON
      let jsonStr = responseText.trim();
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      const startIdx = jsonStr.indexOf('[');
      const endIdx = jsonStr.lastIndexOf(']');
      
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        jsonStr = jsonStr.replace(/[\n\r\t]/g, ' ');
        jsonStr = jsonStr.replace(/,\s*]/g, ']');
        jsonStr = jsonStr.replace(/,\s*}/g, '}');
        
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(card => ({
            front: String(card.front || '').trim(),
            back: String(card.back || '').trim(),
            topic: String(card.topic || 'General').trim(),
            difficulty: ['easy', 'medium', 'hard'].includes(card.difficulty) ? card.difficulty : 'medium'
          }));
        }
      }
    } catch (error) {
      console.error('AI flashcard generation failed:', error.message);
    }

    // Fallback: Generate simple flashcards from text
    return this.generateFallbackFlashcards(text, count);
  }

  generateFallbackFlashcards(text, count) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const flashcards = [];

    for (let i = 0; i < Math.min(count, sentences.length); i++) {
      const sentence = sentences[i].trim();
      const words = sentence.split(' ');
      
      if (words.length > 5) {
        // Create a fill-in-the-blank style flashcard
        const blankIndex = Math.floor(words.length / 2);
        const answer = words[blankIndex];
        words[blankIndex] = '______';
        
        flashcards.push({
          front: `Fill in the blank: ${words.join(' ')}`,
          back: answer,
          topic: 'General',
          difficulty: 'medium'
        });
      }
    }

    return flashcards.length > 0 ? flashcards : [
      {
        front: 'What is the main topic of this content?',
        back: 'Review the material to understand the key concepts',
        topic: 'General',
        difficulty: 'easy'
      }
    ];
  }

  async getFlashcards(userId, contentId = null) {
    const query = { userId };
    if (contentId) {
      query.contentId = contentId;
    }

    const flashcards = await Flashcard.find(query)
      .populate('contentId', 'title type')
      .sort({ createdAt: -1 });

    return flashcards;
  }

  async getDueFlashcards(userId) {
    const now = new Date();
    const flashcards = await Flashcard.find({
      userId,
      nextReview: { $lte: now }
    })
    .populate('contentId', 'title type')
    .sort({ nextReview: 1 })
    .limit(20);

    return flashcards;
  }

  async reviewFlashcard(userId, flashcardId, known) {
    const flashcard = await Flashcard.findById(flashcardId);
    if (!flashcard || flashcard.userId.toString() !== userId) {
      throw new AppError('Flashcard not found', 404);
    }

    flashcard.reviewCount += 1;
    flashcard.lastReviewed = new Date();

    if (known) {
      flashcard.correctCount += 1;
      // Increase mastery level (max 5)
      if (flashcard.masteryLevel < 5) {
        flashcard.masteryLevel += 1;
      }
    } else {
      flashcard.incorrectCount += 1;
      // Decrease mastery level (min 0)
      if (flashcard.masteryLevel > 0) {
        flashcard.masteryLevel -= 1;
      }
    }

    // Calculate next review date
    flashcard.nextReview = flashcard.calculateNextReview();
    flashcard.updatedAt = new Date();

    await flashcard.save();
    return flashcard;
  }

  async deleteFlashcards(userId, contentId) {
    const result = await Flashcard.deleteMany({ userId, contentId });
    return result.deletedCount;
  }

  async exportToAnki(userId, contentId = null) {
    const flashcards = await this.getFlashcards(userId, contentId);

    // Generate Anki-compatible text format
    let ankiText = '';
    flashcards.forEach(card => {
      // Anki format: Front\tBack\tTags
      const front = card.front.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const back = card.back.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const tags = `${card.topic} ${card.difficulty}`;
      ankiText += `${front}\t${back}\t${tags}\n`;
    });

    return ankiText;
  }

  async getStats(userId) {
    const total = await Flashcard.countDocuments({ userId });
    const mastered = await Flashcard.countDocuments({ userId, masteryLevel: 5 });
    const learning = await Flashcard.countDocuments({ userId, masteryLevel: { $gt: 0, $lt: 5 } });
    const new_ = await Flashcard.countDocuments({ userId, masteryLevel: 0 });
    
    const now = new Date();
    const dueForReview = await Flashcard.countDocuments({
      userId,
      nextReview: { $lte: now }
    });

    return {
      total,
      mastered,
      learning,
      new: new_,
      dueForReview
    };
  }
}

export default new FlashcardService();
