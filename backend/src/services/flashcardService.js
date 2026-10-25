import Flashcard from '../models/Flashcard.js';
import Content from '../models/Content.js';
import geminiService from './geminiService.js';
import streakService from './streakService.js';
import { AppError } from '../middleware/errorHandler.js';

export class FlashcardService {
  async generateFlashcards(userId, contentId, count = 10, forceRegenerate = false) {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new AppError('Content not found or unauthorized', 404);
    }

    // Check if flashcards already exist for this content
    const existingFlashcards = await Flashcard.find({ userId, contentId });
    if (existingFlashcards.length > 0 && !forceRegenerate) {
      return existingFlashcards;
    }

    if (forceRegenerate && existingFlashcards.length > 0) {
      await Flashcard.deleteMany({ userId, contentId });
    }

    // Generate flashcards using AI
    const flashcardsData = await this.generateFlashcardsWithAI(
      content.originalText || content.transcript || content.title,
      count,
      content.title
    );

    // Save flashcards to database
    const flashcards = await Flashcard.insertMany(
      flashcardsData.map(card => ({
        userId,
        contentId,
        front: card.front,
        back: card.back,
        topic: card.topic || content.topics?.[0] || 'General',
        difficulty: card.difficulty || 'medium',
        nextReview: new Date()
      }))
    );

    return flashcards;
  }

  async generateFlashcardsWithAI(text, count = 10, title = '') {
    const rawText = String(text || '').trim();
    if (!rawText) {
      return this.generateFallbackFlashcards(title || 'General', count, title);
    }

    // Pick clean substantive excerpt
    let excerpt = rawText;
    if (rawText.length > 8000) {
      const start = rawText.length > 12000 ? 500 : 0;
      excerpt = rawText.substring(start, start + 8000);
    }

    try {
      const prompt = `You are an expert university professor creating study flashcards for students.
Create exactly ${count} focused, concept-driven flashcards based on the study material below.
Title / Subject: ${title || 'Academic Topic'}

STRICT QUALITY RULES:
1. Every card must test a genuine academic concept, definition, algorithm, mechanism, formula, or comparison.
2. DO NOT create cards asking about:
   - College / University names, faculties, departments, or course codes
   - Unit numbers or syllabus outlines (e.g., NEVER ask "What is in Unit IV?" — instead ask "What is Two-Phase Locking and how does it prevent concurrency anomalies?")
   - Page numbers, textbook publishers, or copyright dates
3. For each flashcard provide:
   - "front": Clear, concise question or key term to define (e.g., "What is BCNF?", "How does WAL ensure database durability?")
   - "back": Clear, structured, accurate answer or definition
   - "topic": Specific academic sub-topic (e.g., "Concurrency Control", "Normalization", "Recovery")
   - "difficulty": "easy", "medium", or "hard"

Return ONLY a JSON array of flashcard objects. Example format:
[{"front":"What is Boyce-Codd Normal Form (BCNF)?","back":"A stricter version of 3NF where every functional dependency X -> Y requires X to be a superkey.","topic":"Normalization","difficulty":"hard"}]

Study Material:
${excerpt}`;

      const flashcards = await geminiService.executeWithModel(async (model) => {
        const result = await model.generateContent(prompt);
        const responseText = (await result.response).text().trim();
        let clean = responseText.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
        const startIdx = clean.indexOf('[');
        const endIdx = clean.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          clean = clean.substring(startIdx, endIdx + 1);
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(c => ({
              front: String(c.front || '').trim(),
              back: String(c.back || '').trim(),
              topic: String(c.topic || 'Core Concept').trim(),
              difficulty: ['easy', 'medium', 'hard'].includes(c.difficulty?.toLowerCase()) ? c.difficulty.toLowerCase() : 'medium'
            })).filter(c => c.front.length > 5 && c.back.length > 3);
          }
        }
        throw new Error('Failed to parse flashcards array');
      }, {
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.8
        }
      });

      if (flashcards && flashcards.length > 0) {
        console.log(`✅ AI generated ${flashcards.length} concept-rich flashcards`);
        return flashcards.slice(0, count);
      }
    } catch (err) {
      console.warn('⚠️ AI Flashcard generation note:', err.message);
    }

    return this.generateFallbackFlashcards(rawText, count, title);
  }

  generateFallbackFlashcards(text, count = 10, title = '') {
    const sentences = String(text || '')
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && s.length < 180 && !s.includes('http') && !s.includes('Copyright') && !s.includes('College') && !s.includes('Department'));

    const flashcards = [];

    for (let i = 0; i < Math.min(count, sentences.length); i++) {
      const sentence = sentences[i];
      const words = sentence.split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9-]/g, '')).filter(w => w.length > 4);

      if (words.length >= 2) {
        const keyWord = words[Math.floor(words.length / 2)];
        const prompt = sentence.replace(new RegExp(`\\b${keyWord}\\b`, 'i'), '______');

        flashcards.push({
          front: `Define or complete: "${prompt}"`,
          back: `Key Term: ${keyWord}\nContext: ${sentence}`,
          topic: title || 'Core Concept',
          difficulty: 'medium'
        });
      }
    }

    return flashcards.length > 0 ? flashcards : [
      {
        front: `What is the primary foundation of ${title || 'this study topic'}?`,
        back: `Core architectural principles, formal definitions, and systematic validation rules discussed in the study materials.`,
        topic: title || 'Foundations',
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
    if (!flashcard || flashcard.userId.toString() !== userId.toString()) {
      throw new AppError('Flashcard not found', 404);
    }

    flashcard.reviewCount += 1;
    flashcard.lastReviewed = new Date();

    if (known) {
      flashcard.correctCount += 1;
      if (flashcard.masteryLevel < 5) {
        flashcard.masteryLevel += 1;
      }
    } else {
      flashcard.incorrectCount += 1;
      if (flashcard.masteryLevel > 0) {
        flashcard.masteryLevel -= 1;
      }
    }

    flashcard.nextReview = flashcard.calculateNextReview();
    flashcard.updatedAt = new Date();

    await flashcard.save();
    await streakService.recordStudyActivity(userId);

    return flashcard;
  }

  async deleteFlashcards(userId, contentId) {
    const result = await Flashcard.deleteMany({ userId, contentId });
    return result.deletedCount;
  }

  // 1. Structured Anki Import File (Full Headers + Clear Card Dividers + Anki Compatibility)
  async exportToAnki(userId, contentId = null) {
    const flashcards = await this.getFlashcards(userId, contentId);
    let title = 'Study Deck';
    if (contentId) {
      const content = await Content.findById(contentId);
      if (content) title = content.title;
    }

    const dateStr = new Date().toLocaleDateString('en-GB');

    let ankiText = `# ==============================================================================
# AI STUDY COMPANION - ANKI FLASHCARD DECK
# Deck / Material: ${title}
# Total Cards: ${flashcards.length}   |   Exported: ${dateStr}
#
# INSTRUCTIONS TO IMPORT INTO ANKI:
# 1. Open the Anki application (Desktop, Web, or Mobile).
# 2. Click "File" > "Import" and select this .txt file.
# 3. Anki will automatically detect the tab separator, HTML, and card tags!
# ==============================================================================
#separator:tab
#html:true
#tags column:3
#columns:Front\tBack\tTags
#
`;

    flashcards.forEach((card, idx) => {
      const cardNum = String(idx + 1).padStart(2, '0');
      const topicTag = (card.topic || 'General').replace(/\s+/g, '_');
      const diffTag = card.difficulty || 'medium';
      const tags = `${topicTag} ${diffTag}`;

      let front = (card.front || '')
        .replace(/\t/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\n+/g, '<br>')
        .trim();

      let back = (card.back || '')
        .replace(/\t/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\n+/g, '<br>')
        .trim();

      ankiText += `# ------------------------------------------------------------------------------\n`;
      ankiText += `# Card ${cardNum} of ${flashcards.length} | Topic: ${card.topic || 'General'} | Difficulty: ${diffTag.toUpperCase()}\n`;
      ankiText += `# ------------------------------------------------------------------------------\n`;
      ankiText += `${front}\t${back}\t${tags}\n`;
    });

    return ankiText;
  }

  // 2. Structured Human-Readable Study Deck (Clean Boxed Layout for Notepad / Printing)
  async exportStructured(userId, contentId = null) {
    const flashcards = await this.getFlashcards(userId, contentId);
    let title = 'Study Material Flashcards';
    if (contentId) {
      const content = await Content.findById(contentId);
      if (content) title = content.title;
    }

    const dateStr = new Date().toLocaleDateString('en-GB');
    const border = '='.repeat(80);
    const divider = '-'.repeat(80);

    let doc = `${border}\n`;
    doc += `AI STUDY COMPANION | STRUCTURED FLASHCARD REVISION GUIDE\n`;
    doc += `Topic / Subject: ${title}\n`;
    doc += `Total Flashcards: ${flashcards.length}   |   Exported on: ${dateStr}\n`;
    doc += `${border}\n\n`;

    flashcards.forEach((card, idx) => {
      const cardNum = String(idx + 1).padStart(2, '0');
      const totalNum = String(flashcards.length).padStart(2, '0');
      const topic = card.topic || 'General';
      const difficulty = (card.difficulty || 'medium').toUpperCase();

      doc += `[CARD ${cardNum} / ${totalNum}]\n`;
      doc += `${divider}\n`;
      doc += `TOPIC:       ${topic}\n`;
      doc += `DIFFICULTY:  ${difficulty}\n`;
      doc += `QUESTION:    ${card.front}\n`;
      doc += `${divider}\n`;
      doc += `ANSWER:      ${card.back}\n`;
      doc += `${divider}\n\n\n`;
    });

    doc += `${border}\n`;
    doc += `END OF FLASHCARD DECK (${flashcards.length} Total Cards)\n`;
    doc += `Tip: Review difficult cards first, then practice with the Quiz generator!\n`;
    doc += `${border}\n`;

    return doc;
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
