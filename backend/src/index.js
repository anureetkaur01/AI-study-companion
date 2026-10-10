import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import quizRoutes from './routes/quiz.js';
import analyticsRoutes from './routes/analytics.js';
import resourceRoutes from './routes/resources.js';
import chatbotRoutes from './routes/chatbot.js';
import learningPathRoutes from './routes/learningPath.js';
import comparisonRoutes from './routes/comparison.js';
import flashcardRoutes from './routes/flashcard.js';
import studySessionRoutes from './routes/studySession.js';
import searchRoutes from './routes/search.js';
import profileRoutes from './routes/profile.js';
import teacherRoutes from './routes/teacher.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/study-assistant')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/learning-path', learningPathRoutes);
app.use('/api/comparison', comparisonRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/study-sessions', studySessionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/teacher', teacherRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
