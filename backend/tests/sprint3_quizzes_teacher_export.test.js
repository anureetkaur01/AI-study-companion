import {
  validateQuestionCount,
  evaluateQuestionAnswer,
  calculateQuizScore,
  validateLectureContentStructure
} from '../src/utils/validators.js';
import geminiService from '../src/services/geminiService.js';
import presentationService from '../src/services/presentationService.js';
import pdfLectureService from '../src/services/pdfLectureService.js';
import quizService from '../src/services/quizService.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Sprint 3: AI Quizzes, Teacher Material Generation & PPT/PDF Exports', () => {

  describe('Boundary Value Analysis (BVA): Quiz Question Counts (FR-09, PRD Section 10.4)', () => {
    test('QUIZ-BVA-01: rejects question count of 4 (just below boundary)', () => {
      expect(validateQuestionCount(4)).toBe(false);
    });

    test('QUIZ-BVA-02: accepts question count of 5 (on minimum boundary)', () => {
      expect(validateQuestionCount(5)).toBe(true);
    });

    test('QUIZ-BVA-03: accepts question count of 6 (just above minimum boundary)', () => {
      expect(validateQuestionCount(6)).toBe(true);
    });

    test('QUIZ-BVA-04: accepts question count of 19 (just below maximum boundary)', () => {
      expect(validateQuestionCount(19)).toBe(true);
    });

    test('QUIZ-BVA-05: accepts question count of 20 (on maximum boundary)', () => {
      expect(validateQuestionCount(20)).toBe(true);
    });

    test('QUIZ-BVA-06: rejects question count of 21 (just above maximum boundary)', () => {
      expect(validateQuestionCount(21)).toBe(false);
    });

    test('QUIZ-EP-01: Equivalence Partitioning - rejects non-integer, negative, or invalid formats', () => {
      expect(validateQuestionCount('abc')).toBe(false);
      expect(validateQuestionCount(-5)).toBe(false);
      expect(validateQuestionCount(0)).toBe(false);
      expect(validateQuestionCount(7.5)).toBe(false);
      expect(validateQuestionCount(null)).toBe(false);
      expect(validateQuestionCount(undefined)).toBe(false);
    });
  });

  describe('Decision-Table-Based Testing: Quiz Scoring Matrix (FR-10, PRD Section 10.5)', () => {
    test('SCORE-DT-01: Condition 1: Answer Not Submitted -> Expected Score = 0', () => {
      const resultUndefined = evaluateQuestionAnswer(undefined, 'Paris');
      expect(resultUndefined.isCorrect).toBe(false);
      expect(resultUndefined.score).toBe(0);

      const resultNull = evaluateQuestionAnswer(null, 'Paris');
      expect(resultNull.isCorrect).toBe(false);
      expect(resultNull.score).toBe(0);

      const resultEmpty = evaluateQuestionAnswer('', 'Paris');
      expect(resultEmpty.isCorrect).toBe(false);
      expect(resultEmpty.score).toBe(0);

      const resultWhitespace = evaluateQuestionAnswer('   ', 'Paris');
      expect(resultWhitespace.isCorrect).toBe(false);
      expect(resultWhitespace.score).toBe(0);
    });

    test('SCORE-DT-02: Condition 2: Answer Submitted, but Incorrect -> Expected Score = 0', () => {
      const result = evaluateQuestionAnswer('London', 'Paris');
      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
    });

    test('SCORE-DT-03: Condition 3: Answer Submitted and Correct -> Expected Score = 1', () => {
      const resultExact = evaluateQuestionAnswer('Paris', 'Paris');
      expect(resultExact.isCorrect).toBe(true);
      expect(resultExact.score).toBe(1);

      // Case-insensitivity & whitespace tolerance
      const resultCase = evaluateQuestionAnswer('  pArIs  ', 'Paris');
      expect(resultCase.isCorrect).toBe(true);
      expect(resultCase.score).toBe(1);
    });

    test('SCORE-CALC-01: calculates mixed results accurately (3 correct, 1 wrong, 1 unanswered -> 60%)', () => {
      const sampleQuestions = [
        { id: 'q0', question: 'Q1', correctAnswer: 'A' },
        { id: 'q1', question: 'Q2', correctAnswer: 'B' },
        { id: 'q2', question: 'Q3', correctAnswer: 'C' },
        { id: 'q3', question: 'Q4', correctAnswer: 'D' },
        { id: 'q4', question: 'Q5', correctAnswer: 'A' },
      ];
      const submittedAnswers = ['A', 'B', 'WrongAnswer', undefined, 'A'];

      const result = calculateQuizScore(submittedAnswers, sampleQuestions);
      expect(result.score).toBe(3);
      expect(result.totalQuestions).toBe(5);
      expect(result.accuracy).toBe(60);
      expect(result.evaluatedAnswers).toHaveLength(5);
      expect(result.evaluatedAnswers[0].isCorrect).toBe(true);
      expect(result.evaluatedAnswers[1].isCorrect).toBe(true);
      expect(result.evaluatedAnswers[2].isCorrect).toBe(false);
      expect(result.evaluatedAnswers[3].isCorrect).toBe(false);
      expect(result.evaluatedAnswers[4].isCorrect).toBe(true);
    });

    test('SCORE-CALC-02: calculates perfect score accurately (5/5 -> 100%)', () => {
      const sampleQuestions = [
        { id: 'q0', question: 'Q1', correctAnswer: 'OptA' },
        { id: 'q1', question: 'Q2', correctAnswer: 'OptB' },
      ];
      const submittedAnswers = ['OptA', 'OptB'];

      const result = calculateQuizScore(submittedAnswers, sampleQuestions);
      expect(result.score).toBe(2);
      expect(result.accuracy).toBe(100);
    });

    test('SCORE-CALC-03: calculates zero score accurately (0/5 -> 0%)', () => {
      const sampleQuestions = [
        { id: 'q0', question: 'Q1', correctAnswer: 'OptA' },
        { id: 'q1', question: 'Q2', correctAnswer: 'OptB' },
      ];
      const submittedAnswers = ['Wrong1', 'Wrong2'];

      const result = calculateQuizScore(submittedAnswers, sampleQuestions);
      expect(result.score).toBe(0);
      expect(result.accuracy).toBe(0);
    });
  });

  describe('AI Quiz Generation Structure & Service Logic (FR-09)', () => {
    test('QUIZ-GEN-01: generateQuiz generates configured number of questions with 4 options and valid answer', async () => {
      const questions = await geminiService.generateQuiz('Photosynthesis in plants', 'medium', 7);
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBe(7);

      questions.forEach((q, idx) => {
        expect(q.question).toBeDefined();
        expect(Array.isArray(q.options)).toBe(true);
        expect(q.options.length).toBe(4);
        expect(q.options).toContain(q.correctAnswer);
        expect(q.explanation).toBeDefined();
      });
    });
  });

  describe('Teacher Lecture Content Structure Validation (FR-11)', () => {
    const validLecture = {
      title: 'Introduction to Software Testing',
      topic: 'Software Verification',
      learningObjectives: [
        'Understand equivalence partitioning',
        'Apply boundary value analysis'
      ],
      introduction: 'Software testing is a critical discipline for verifying system requirements.',
      mainConcepts: [
        {
          title: 'Equivalence Partitioning',
          explanation: 'Dividing input domain into classes of equivalent data.',
          examples: ['Valid and invalid password lengths']
        },
        {
          title: 'Boundary Value Analysis',
          explanation: 'Testing extreme values on and immediately around boundaries.',
          examples: ['Testing inputs 4, 5, 6 for a 5-question boundary']
        }
      ],
      summary: 'Thorough testing incorporates both positive and negative boundary conditions.',
      reviewQuestions: [
        'What is the difference between BVA and EP?',
        'How does decision-table testing prevent missed condition combinations?'
      ]
    };

    test('LECT-VAL-01: validates complete, well-formed lecture content structure', () => {
      expect(validateLectureContentStructure(validLecture)).toBe(true);
    });

    test('LECT-VAL-02: rejects lecture content missing essential structural components', () => {
      expect(validateLectureContentStructure(null)).toBe(false);
      expect(validateLectureContentStructure({})).toBe(false);
      expect(validateLectureContentStructure({ ...validLecture, title: '' })).toBe(false);
      expect(validateLectureContentStructure({ ...validLecture, learningObjectives: [] })).toBe(false);
      expect(validateLectureContentStructure({ ...validLecture, introduction: '' })).toBe(false);
      expect(validateLectureContentStructure({ ...validLecture, mainConcepts: [] })).toBe(false);
      expect(validateLectureContentStructure({ ...validLecture, summary: '' })).toBe(false);
    });

    test('LECT-GEN-01: generates structured lecture content with all PRD required sections', async () => {
      const lectureContent = await geminiService.generateLectureContent('Binary Search Algorithms');
      expect(lectureContent.title).toBeDefined();
      expect(lectureContent.learningObjectives.length).toBeGreaterThan(0);
      expect(lectureContent.introduction).toBeDefined();
      expect(lectureContent.mainConcepts.length).toBeGreaterThan(0);
      expect(lectureContent.summary).toBeDefined();
      expect(lectureContent.reviewQuestions.length).toBeGreaterThan(0);
    });
  });

  describe('PowerPoint Presentation Generation (FR-12)', () => {
    const testLecture = {
      title: 'Unit Testing with Jest',
      topic: 'Software Testing',
      learningObjectives: ['Define test suites', 'Execute assertions'],
      introduction: 'Jest is a delightful JavaScript Testing Framework.',
      mainConcepts: [
        {
          title: 'Matchers',
          explanation: 'Jest uses matchers to test values in different ways.',
          examples: ['expect(val).toBe(true)', 'expect(fn).toThrow()']
        }
      ],
      summary: 'Automated unit tests ensure regressions are caught early.',
      reviewQuestions: ['Why are unit tests important in CI/CD?']
    };

    test('PPT-GEN-01: generates downloadable PPTX binary buffer from structured lecture', async () => {
      const pptxBuffer = await presentationService.generatePowerPoint(testLecture);
      expect(Buffer.isBuffer(pptxBuffer)).toBe(true);
      expect(pptxBuffer.length).toBeGreaterThan(1000); // Valid zip/pptx structure
    });

    test('PPT-VAL-01: throws AppError if lecture object or title is missing', async () => {
      await expect(presentationService.generatePowerPoint(null)).rejects.toThrow(AppError);
      await expect(presentationService.generatePowerPoint({})).rejects.toThrow(AppError);
    });
  });

  describe('PDF Lecture Notes Generation (FR-13)', () => {
    const testLecture = {
      title: 'Unit Testing with Jest',
      topic: 'Software Testing',
      learningObjectives: ['Define test suites', 'Execute assertions'],
      introduction: 'Jest is a delightful JavaScript Testing Framework.',
      mainConcepts: [
        {
          title: 'Matchers',
          explanation: 'Jest uses matchers to test values in different ways.',
          examples: ['expect(val).toBe(true)']
        }
      ],
      summary: 'Automated unit tests ensure regressions are caught early.',
      reviewQuestions: ['Why are unit tests important in CI/CD?']
    };

    test('PDF-GEN-01: generates downloadable PDF binary buffer from structured lecture', async () => {
      const pdfBuffer = await pdfLectureService.generatePdfNotes(testLecture);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);
      // Valid PDF files start with %PDF- header magic bytes
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
    });

    test('PDF-VAL-01: throws AppError if lecture object or title is missing', async () => {
      await expect(pdfLectureService.generatePdfNotes(null)).rejects.toThrow(AppError);
      await expect(pdfLectureService.generatePdfNotes({})).rejects.toThrow(AppError);
    });
  });
});
