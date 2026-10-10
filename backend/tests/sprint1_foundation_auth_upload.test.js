import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  validateEmail,
  validatePassword,
  validateRole,
  validateFileExtension,
  validateFileSize,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_FILE_SIZE_BYTES
} from '../src/utils/validators.js';
import { authorizeRoles } from '../src/middleware/auth.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Sprint 1: Foundation, Authentication, Roles & Material Management', () => {

  describe('Unit Testing & Equivalence Partitioning: Email Validation (FR-01)', () => {
    it('AUTH-UNIT-01: accepts standard valid email addresses', () => {
      expect(validateEmail('student@example.com')).toBe(true);
      expect(validateEmail('teacher.john@university.edu')).toBe(true);
      expect(validateEmail('user+study@sub.domain.org')).toBe(true);
    });

    it('AUTH-UNIT-02: rejects invalid email formats (Equivalence Partitioning)', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('plainaddress')).toBe(false);
      expect(validateEmail('@missingusername.com')).toBe(false);
      expect(validateEmail('missingdomain@.com')).toBe(false);
      expect(validateEmail('spaces in@email.com')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });
  });

  describe('Boundary Value Analysis (BVA): Password Rules (FR-01)', () => {
    it('AUTH-BVA-01: rejects password of length 5 (just below boundary)', () => {
      const fiveChars = '12345';
      expect(fiveChars.length).toBe(MIN_PASSWORD_LENGTH - 1);
      expect(validatePassword(fiveChars)).toBe(false);
    });

    it('AUTH-BVA-02: accepts password of length 6 (on minimum boundary)', () => {
      const sixChars = '123456';
      expect(sixChars.length).toBe(MIN_PASSWORD_LENGTH);
      expect(validatePassword(sixChars)).toBe(true);
    });

    it('AUTH-BVA-03: accepts password of length 7 (just above minimum boundary)', () => {
      const sevenChars = '1234567';
      expect(validatePassword(sevenChars)).toBe(true);
    });

    it('AUTH-BVA-04: accepts password of length 128 (on maximum boundary)', () => {
      const maxPass = 'a'.repeat(MAX_PASSWORD_LENGTH);
      expect(validatePassword(maxPass)).toBe(true);
    });

    it('AUTH-BVA-05: rejects password of length 129 (just above maximum boundary)', () => {
      const tooLongPass = 'a'.repeat(MAX_PASSWORD_LENGTH + 1);
      expect(validatePassword(tooLongPass)).toBe(false);
    });
  });

  describe('Role Assignment & Validation (FR-02)', () => {
    it('ROLE-UNIT-01: recognizes valid roles student and teacher', () => {
      expect(validateRole('student')).toBe('student');
      expect(validateRole('teacher')).toBe('teacher');
      expect(validateRole('TEACHER')).toBe('teacher');
      expect(validateRole('Student')).toBe('student');
    });

    it('ROLE-UNIT-02: defaults missing role to student', () => {
      expect(validateRole('')).toBe('student');
      expect(validateRole(null)).toBe('student');
      expect(validateRole(undefined)).toBe('student');
    });

    it('ROLE-UNIT-03: rejects invalid role strings', () => {
      expect(validateRole('admin')).toBe(null);
      expect(validateRole('moderator')).toBe(null);
      expect(validateRole('superteacher')).toBe(null);
    });

    it('ROLE-ACCESS-01: authorizeRoles permits authorized role', () => {
      const req = { userRole: 'teacher' };
      const res = {};
      const next = jest.fn();
      const middleware = authorizeRoles('teacher');
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('ROLE-ACCESS-02: authorizeRoles rejects unauthorized role with 403', () => {
      const req = { userRole: 'student' };
      const res = {};
      const next = jest.fn();
      const middleware = authorizeRoles('teacher');
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
    });
  });

  describe('Equivalence Partitioning & BVA: File Uploads (FR-03)', () => {
    it('FILE-EP-01: accepts all valid document, image and video extensions', () => {
      expect(validateFileExtension('notes.pdf')).toBe(true);
      expect(validateFileExtension('syllabus.docx')).toBe(true);
      expect(validateFileExtension('handout.doc')).toBe(true);
      expect(validateFileExtension('readme.txt')).toBe(true);
      expect(validateFileExtension('diagram.png')).toBe(true);
      expect(validateFileExtension('scan.jpg')).toBe(true);
      expect(validateFileExtension('photo.jpeg')).toBe(true);
      expect(validateFileExtension('whiteboard.webp')).toBe(true);
      expect(validateFileExtension('lecture.mp4')).toBe(true);
    });

    it('FILE-EP-02: rejects unsupported file formats', () => {
      expect(validateFileExtension('malware.exe')).toBe(false);
      expect(validateFileExtension('archive.zip')).toBe(false);
      expect(validateFileExtension('script.bat')).toBe(false);
      expect(validateFileExtension('style.css')).toBe(false);
      expect(validateFileExtension('')).toBe(false);
      expect(validateFileExtension(null)).toBe(false);
    });

    it('FILE-BVA-01: accepts file sizes within boundary (e.g. 50MB limit)', () => {
      expect(validateFileSize(1024)).toBe(true); // 1KB
      expect(validateFileSize(MAX_FILE_SIZE_BYTES)).toBe(true); // Exactly 50MB
      expect(validateFileSize(MAX_FILE_SIZE_BYTES - 1)).toBe(true); // 50MB - 1 byte
    });

    it('FILE-BVA-02: rejects file sizes exceeding boundary (>50MB)', () => {
      expect(validateFileSize(MAX_FILE_SIZE_BYTES + 1)).toBe(false); // 50MB + 1 byte
      expect(validateFileSize(100 * 1024 * 1024)).toBe(false); // 100MB
      expect(validateFileSize(0)).toBe(false); // 0 bytes invalid
      expect(validateFileSize(-10)).toBe(false); // negative invalid
    });
  });
});
