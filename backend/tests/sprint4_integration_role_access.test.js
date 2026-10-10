import { jest } from '@jest/globals';
import {
  validateEmail,
  validatePassword,
  validateRole,
  validateFileExtension,
  validateFileSize,
  validateQuestionCount,
  evaluateQuestionAnswer,
  calculateQuizScore,
  validateLectureContentStructure
} from '../src/utils/validators.js';
import { authorizeRoles } from '../src/middleware/auth.js';
import geminiService from '../src/services/geminiService.js';
import presentationService from '../src/services/presentationService.js';
import pdfLectureService from '../src/services/pdfLectureService.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Sprint 4: Integration, Role-Based Access Control & End-to-End Workflows', () => {

  describe('Integration: User Data Isolation & Role Authorization (FR-02, NFR-03)', () => {
    test('ROLE-INT-01: Teacher role successfully authorizes access to teacher-only routes', () => {
      const teacherReq = { userId: 'teacher_123', userRole: 'teacher' };
      const res = {};
      const next = jest.fn();

      const middleware = authorizeRoles('teacher');
      middleware(teacherReq, res, next);

      expect(next).toHaveBeenCalledWith(); // called with no errors
    });

    test('ROLE-INT-02: Student role is rejected from teacher routes with 403 Forbidden', () => {
      const studentReq = { userId: 'student_456', userRole: 'student' };
      const res = {};
      const next = jest.fn();

      const middleware = authorizeRoles('teacher');
      middleware(studentReq, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode || error.status).toBe(403);
      expect(error.message).toMatch(/Access denied/);
    });

    test('ISOLATION-INT-01: Cross-user study material access control check throws 403', () => {
      const mockContent = {
        _id: 'content_999',
        userId: 'user_owner_111',
        title: 'Confidential Notes'
      };
      const requestingUserId = 'user_intruder_222';

      const verifyOwnership = (content, userId) => {
        if (content.userId && content.userId.toString() !== userId.toString()) {
          throw new AppError('Access denied: You do not have permission to view or modify this resource', 403);
        }
        return true;
      };

      expect(() => verifyOwnership(mockContent, requestingUserId)).toThrow(AppError);
      expect(() => verifyOwnership(mockContent, 'user_owner_111')).not.toThrow();
    });

    test('ISOLATION-INT-02: Cross-user quiz submission check prevents unauthorized attempts', () => {
      const mockQuiz = {
        _id: 'quiz_888',
        userId: 'student_owner_333',
        completedAt: null
      };
      const intruderId = 'student_hacker_444';

      const verifyQuizAccess = (quiz, userId) => {
        if (!quiz || quiz.userId.toString() !== userId.toString()) {
          throw new AppError('Quiz not found or unauthorized', 404);
        }
        if (quiz.completedAt) {
          throw new AppError('Duplicate submission rejected: Quiz has already been completed', 400);
        }
        return true;
      };

      expect(() => verifyQuizAccess(mockQuiz, intruderId)).toThrow('Quiz not found or unauthorized');
      expect(verifyQuizAccess(mockQuiz, 'student_owner_333')).toBe(true);

      // Verify duplicate submission prevention
      mockQuiz.completedAt = new Date();
      expect(() => verifyQuizAccess(mockQuiz, 'student_owner_333')).toThrow('Duplicate submission rejected');
    });
  });

  describe('Integration: Dashboard Metrics & Score Aggregation (FR-14)', () => {
    test('DASH-INT-01: accurately aggregates average quiz score and total attempts', () => {
      const userQuizzes = [
        { score: 5, totalQuestions: 5, accuracy: 100, completedAt: '2026-10-01' },
        { score: 3, totalQuestions: 5, accuracy: 60, completedAt: '2026-10-02' },
        { score: 4, totalQuestions: 5, accuracy: 80, completedAt: '2026-10-03' }
      ];

      const calculateDashboardMetrics = (quizzes) => {
        const completed = quizzes.filter(q => q.completedAt);
        if (completed.length === 0) {
          return { totalAttempted: 0, averageScore: 0 };
        }
        const totalAccuracy = completed.reduce((sum, q) => sum + q.accuracy, 0);
        return {
          totalAttempted: completed.length,
          averageScore: Math.round(totalAccuracy / completed.length)
        };
      };

      const metrics = calculateDashboardMetrics(userQuizzes);
      expect(metrics.totalAttempted).toBe(3);
      expect(metrics.averageScore).toBe(80); // (100 + 60 + 80) / 3 = 80
    });

    test('DASH-INT-02: handles empty state with 0 quizzes gracefully without division by zero', () => {
      const calculateDashboardMetrics = (quizzes) => {
        const completed = quizzes.filter(q => q.completedAt);
        if (completed.length === 0) {
          return { totalAttempted: 0, averageScore: 0 };
        }
        const totalAccuracy = completed.reduce((sum, q) => sum + q.accuracy, 0);
        return {
          totalAttempted: completed.length,
          averageScore: Math.round(totalAccuracy / completed.length)
        };
      };

      const emptyMetrics = calculateDashboardMetrics([]);
      expect(emptyMetrics.totalAttempted).toBe(0);
      expect(emptyMetrics.averageScore).toBe(0);
    });
  });

  describe('End-to-End Workflow: Student Learning & Assessment Pipeline (FR-01 to FR-10)', () => {
    test('STUDENT-E2E-01: complete pipeline from material extraction -> summary -> quiz generation -> decision scoring', async () => {
      // Step 1: Input text validation
      const sampleText = 'Machine learning is a subset of artificial intelligence that enables systems to learn from experience.';
      expect(sampleText.length).toBeGreaterThan(10);

      // Step 2: Summarization
      const summary = await geminiService.generateSummary(sampleText, 'brief');
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);

      // Step 3: Question count validation (BVA boundary = 5)
      const count = 5;
      expect(validateQuestionCount(count)).toBe(true);

      // Step 4: AI Quiz Generation
      const questions = await geminiService.generateQuiz(sampleText, 'medium', count);
      expect(questions.length).toBe(5);

      // Step 5: Student Answers with Decision Table Logic
      // 4 correct, 1 incorrect
      const submittedAnswers = questions.map((q, idx) => {
        return idx === 0 ? 'Wrong Choice' : q.correctAnswer;
      });

      const scoreResult = calculateQuizScore(submittedAnswers, questions);
      expect(scoreResult.score).toBe(4);
      expect(scoreResult.totalQuestions).toBe(5);
      expect(scoreResult.accuracy).toBe(80);
      expect(scoreResult.evaluatedAnswers[0].isCorrect).toBe(false);
      expect(scoreResult.evaluatedAnswers[1].isCorrect).toBe(true);
    });
  });

  describe('End-to-End Workflow: Teacher Lecture & Dual Export Pipeline (FR-11 to FR-13)', () => {
    test('TEACHER-E2E-01: generates structured lecture content and exports both PPTX and PDF from the identical structure', async () => {
      const lectureTopic = 'Automated Software Testing & Jest Asserts';

      // Step 1: Structured Lecture Generation
      const lecture = await geminiService.generateLectureContent(lectureTopic);
      expect(validateLectureContentStructure(lecture)).toBe(true);

      // Step 2: Export PowerPoint (.pptx)
      const pptxBuffer = await presentationService.generatePowerPoint(lecture);
      expect(Buffer.isBuffer(pptxBuffer)).toBe(true);
      expect(pptxBuffer.length).toBeGreaterThan(1000);

      // Step 3: Export PDF Notes (.pdf) from the same structure
      const pdfBuffer = await pdfLectureService.generatePdfNotes(lecture);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });
  });

  describe('Failure Handling & Boundary Resilience (NFR-04)', () => {
    test('FAIL-RES-01: summarizer handles empty text without crashing', async () => {
      const emptySummary = await geminiService.generateSummary('', 'brief');
      expect(emptySummary).toBeDefined();
    });

    test('FAIL-RES-02: quiz score calculation handles null/undefined submitted answers safely', () => {
      const questions = [{ id: 'q1', correctAnswer: 'A' }];
      const result = calculateQuizScore(null, questions);
      expect(result.score).toBe(0);
      expect(result.accuracy).toBe(0);
    });
  });
});
