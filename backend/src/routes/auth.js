import express from 'express';
import authService from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      throw new AppError('Missing required fields', 400);
    }
    const result = await authService.register(name, email, password, role);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('Missing email or password', 400);
    }
    const result = await authService.login(email, password);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.userId);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

export default router;
