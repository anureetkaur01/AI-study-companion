/**
 * Core validation and business logic utilities for AI Study Companion.
 * Separated for deterministic unit testing, equivalence partitioning,
 * boundary value analysis, and decision-table-based testing.
 */

// Email validation regex (RFC 5322 compliant subset)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
};

// Password rules: minimum 6 characters, maximum 128 characters
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;

export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  const len = password.length;
  return len >= MIN_PASSWORD_LENGTH && len <= MAX_PASSWORD_LENGTH;
};

// Role rules: 'student' or 'teacher'
export const VALID_ROLES = ['student', 'teacher'];

export const validateRole = (role) => {
  if (!role) return 'student'; // default role
  const normalized = String(role).trim().toLowerCase();
  if (VALID_ROLES.includes(normalized)) {
    return normalized;
  }
  return null;
};

// Supported file extensions and size limit (50MB)
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const SUPPORTED_DOC_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'];
export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.webm'];
export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_DOC_EXTENSIONS,
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_VIDEO_EXTENSIONS
];

export const validateFileExtension = (filename) => {
  if (!filename || typeof filename !== 'string') return false;
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return ALL_SUPPORTED_EXTENSIONS.includes(ext);
};

export const validateFileSize = (sizeInBytes, maxBytes = MAX_FILE_SIZE_BYTES) => {
  if (typeof sizeInBytes !== 'number' || sizeInBytes <= 0) return false;
  return sizeInBytes <= maxBytes;
};

// Quiz Question Count Limits: 5 to 20 (PRD Boundary Value Analysis Section 10.4)
export const MIN_QUIZ_QUESTIONS = 5;
export const MAX_QUIZ_QUESTIONS = 20;

export const validateQuestionCount = (count) => {
  const num = Number(count);
  if (!Number.isInteger(num)) return false;
  return num >= MIN_QUIZ_QUESTIONS && num <= MAX_QUIZ_QUESTIONS;
};

// Quiz Scoring Matrix (Decision-Table-Based Testing Section 10.5)
// Rule 1: Answer not submitted -> score 0
// Rule 2: Answer submitted and Incorrect -> score 0
// Rule 3: Answer submitted and Correct -> score 1
export const evaluateQuestionAnswer = (submittedAnswer, correctAnswer) => {
  if (submittedAnswer === undefined || submittedAnswer === null || String(submittedAnswer).trim() === '') {
    return { isCorrect: false, score: 0 };
  }
  const cleanSubmitted = String(submittedAnswer).trim().toLowerCase();
  const cleanCorrect = String(correctAnswer).trim().toLowerCase();
  const isCorrect = cleanSubmitted === cleanCorrect;
  return {
    isCorrect,
    score: isCorrect ? 1 : 0
  };
};

export const calculateQuizScore = (userAnswers, questions) => {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { score: 0, totalQuestions: 0, accuracy: 0, evaluatedAnswers: [] };
  }

  let totalScore = 0;
  const evaluatedAnswers = questions.map((q, idx) => {
    const rawAnswer = userAnswers && userAnswers[idx];
    const { isCorrect, score } = evaluateQuestionAnswer(rawAnswer, q.correctAnswer);
    totalScore += score;
    return {
      questionId: q.id || `q${idx}`,
      answer: rawAnswer || '',
      isCorrect,
      score
    };
  });

  const accuracy = Math.round((totalScore / questions.length) * 100);
  return {
    score: totalScore,
    totalQuestions: questions.length,
    accuracy,
    evaluatedAnswers
  };
};

// Lecture Content Validation (FR-11)
export const validateLectureContentStructure = (content) => {
  if (!content || typeof content !== 'object') return false;
  if (!content.title || typeof content.title !== 'string' || content.title.trim() === '') return false;
  if (!Array.isArray(content.learningObjectives) || content.learningObjectives.length === 0) return false;
  if (!content.introduction || typeof content.introduction !== 'string' || content.introduction.trim() === '') return false;
  if (!Array.isArray(content.mainConcepts) || content.mainConcepts.length === 0) return false;
  if (!content.summary || typeof content.summary !== 'string' || content.summary.trim() === '') return false;
  return true;
};
