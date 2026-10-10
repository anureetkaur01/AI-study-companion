import express from 'express';
import quizService from '../services/quizService.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const { contentId, difficulty, count } = req.body;
    if (!contentId) {
      throw new AppError('Missing contentId', 400);
    }

    const selectedDifficulty = difficulty || await quizService.getAdaptiveDifficulty(req.userId, contentId);
    const quiz = await quizService.generateQuiz(req.userId, contentId, selectedDifficulty, count || 5);
    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/submit', authenticate, async (req, res, next) => {
  try {
    const { answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      throw new AppError('Invalid answers format', 400);
    }
    const quiz = await quizService.submitQuiz(req.params.id, req.userId, answers);
    res.json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
});

router.get('/history', authenticate, async (req, res, next) => {
  try {
    const history = await quizService.getQuizHistory(req.userId);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

export default router;
