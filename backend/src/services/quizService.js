import Quiz from '../models/Quiz.js';
import Content from '../models/Content.js';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import geminiService from './geminiService.js';
import topicProgressService from './topicProgressService.js';
import streakService from './streakService.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateQuestionCount, calculateQuizScore } from '../utils/validators.js';

export class QuizService {
  async generateQuiz(userId, contentId, difficulty = 'medium', count = 5) {
    const numCount = Number(count) || 5;
    if (!validateQuestionCount(numCount)) {
      throw new AppError('Question count must be between 5 and 20', 400);
    }

    const content = await Content.findById(contentId);
    if (!content) {
      throw new AppError('Content not found', 404);
    }

    // Verify content ownership / private material isolation
    if (content.userId && content.userId.toString() !== userId.toString()) {
      throw new AppError('Access denied to private study material', 403);
    }

    // Get previous quizzes for this user & content to exclude duplicate questions!
    const previousQuizzes = await Quiz.find({ userId, contentId }).sort({ createdAt: -1 }).limit(5);
    const excludeQuestions = previousQuizzes.flatMap(q => (q.questions || []).map(item => item.question));

    // Get weak topics for adaptive generation
    const weakTopics = await topicProgressService.getWeakTopics(userId);
    const weakTopicNames = weakTopics.map(t => t.topic);
    
    // Inject weak topics into prompt if they exist
    let prompt = content.originalText || content.transcript || content.title;
    if (weakTopicNames.length > 0) {
      prompt = `Generate quiz questions. Focus more on these weak topics: ${weakTopicNames.join(', ')}\n\nContent: ${prompt}`;
    }

    const questions = await geminiService.generateQuiz(prompt, difficulty, numCount, {
      excludeQuestions,
      title: content.title
    });
    
    const quiz = new Quiz({
      userId,
      contentId,
      difficulty,
      questions: questions.map((q, idx) => ({
        id: `q${idx}`,
        question: q.question,
        type: 'mcq',
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: (content.topics && content.topics[idx % content.topics.length]) || 'General'
      }))
    });

    await quiz.save();
    return quiz;
  }

  async submitQuiz(quizId, userId, answers) {
    const quiz = await Quiz.findById(quizId);
    if (!quiz || quiz.userId.toString() !== userId.toString()) {
      throw new AppError('Quiz not found or unauthorized', 404);
    }

    // Duplicate submission prevention (FR-10: Duplicate submissions do not incorrectly duplicate results)
    if (quiz.completedAt) {
      throw new AppError('Duplicate submission rejected: Quiz has already been completed', 400);
    }

    if (!Array.isArray(answers)) {
      throw new AppError('Answers must be provided as an array', 400);
    }

    // Calculate score using verified business logic matrix (Decision-Table-Based)
    const { score, accuracy, evaluatedAnswers } = calculateQuizScore(answers, quiz.questions);
    
    quiz.userAnswers = evaluatedAnswers.map((ea, idx) => {
      const q = quiz.questions[idx];
      return {
        questionId: q.id || `q${idx}`,
        answer: ea.answer,
        isCorrect: ea.isCorrect,
        timeSpent: 0
      };
    });

    quiz.score = score;
    quiz.accuracy = accuracy;
    quiz.completedAt = new Date();

    await quiz.save();

    // Update topic progress for each question
    for (let idx = 0; idx < quiz.questions.length; idx++) {
      const question = quiz.questions[idx];
      const answer = quiz.userAnswers[idx];
      console.log(`📊 Updating topic "${question.topic}" with isCorrect: ${answer.isCorrect}`);
      await topicProgressService.updateTopicProgress(userId, question.topic, answer.isCorrect);
    }

    // Update user stats
    const user = await User.findById(userId);
    user.totalQuizzesTaken += 1;
    user.averageAccuracy = ((user.averageAccuracy * (user.totalQuizzesTaken - 1)) + quiz.accuracy) / user.totalQuizzesTaken;
    user.xp += Math.floor(quiz.accuracy / 10);
    await user.save();

    // Update student profile stats
    const profile = await StudentProfile.findOne({ userId });
    if (profile) {
      profile.totalQuizzesTaken = user.totalQuizzesTaken;
      profile.averageAccuracy = user.averageAccuracy;
      profile.totalXP = user.xp;
      profile.averageQuizScore = ((profile.averageQuizScore * (profile.totalQuizzesTaken - 1)) + quiz.accuracy) / profile.totalQuizzesTaken;
      profile.lastActiveAt = new Date();
      await profile.save();
    }

    // Record study activity to advance streak
    await streakService.recordStudyActivity(userId);

    console.log(`✅ Quiz ${quizId} completed: ${score}/${quiz.questions.length} (${quiz.accuracy}%)`);
    return quiz;
  }

  async getAdaptiveDifficulty(userId, contentId) {
    const recentQuizzes = await Quiz.find({ userId, contentId }).sort({ createdAt: -1 }).limit(3);
    
    if (recentQuizzes.length === 0) return 'easy';

    const avgAccuracy = recentQuizzes.reduce((sum, q) => sum + q.accuracy, 0) / recentQuizzes.length;

    if (avgAccuracy > 80) return 'hard';
    if (avgAccuracy < 50) return 'easy';
    return 'medium';
  }

  async getQuizHistory(userId) {
    return Quiz.find({ userId }).populate('contentId').sort({ createdAt: -1 });
  }
}

export default new QuizService();
