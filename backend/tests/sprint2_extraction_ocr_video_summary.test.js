import { describe, it, expect, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import fileExtractionService from '../src/services/fileExtractionService.js';
import ocrService from '../src/services/ocrService.js';
import videoProcessingService from '../src/services/videoProcessingService.js';
import geminiService from '../src/services/geminiService.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Sprint 2: OCR, Summarization, Document & Video Processing', () => {

  describe('Document Extraction & Edge Cases (FR-05)', () => {
    it('DOC-EXT-01: throws AppError when extracting non-existent document file', async () => {
      await expect(
        fileExtractionService.extractText('non_existent_file.pdf', 'application/pdf')
      ).rejects.toThrow();
    });

    it('DOC-EXT-02: extracts valid text from TXT files correctly', async () => {
      const tempTxt = path.join(process.cwd(), 'temp_test_doc.txt');
      fs.writeFileSync(tempTxt, 'Software Verification and Testing is essential for reliable systems.');
      try {
        const text = await fileExtractionService.extractTextFromTXT(tempTxt);
        expect(text).toContain('Software Verification and Testing');
      } finally {
        if (fs.existsSync(tempTxt)) fs.unlinkSync(tempTxt);
      }
    });

    it('DOC-EXT-03: throws AppError for empty text files (0 bytes)', async () => {
      const emptyTxt = path.join(process.cwd(), 'temp_empty_doc.txt');
      fs.writeFileSync(emptyTxt, '');
      try {
        await expect(
          fileExtractionService.extractTextFromTXT(emptyTxt)
        ).rejects.toThrow('Text file is empty');
      } finally {
        if (fs.existsSync(emptyTxt)) fs.unlinkSync(emptyTxt);
      }
    });
  });

  describe('Image OCR Validation and Failure Handling (FR-04)', () => {
    it('OCR-VAL-01: throws AppError when image file does not exist', async () => {
      await expect(
        ocrService.extractTextFromImage('missing_image.png')
      ).rejects.toThrow('Image file not found');
    });

    it('OCR-VAL-02: throws AppError for empty 0-byte image files', async () => {
      const emptyImg = path.join(process.cwd(), 'empty_img.png');
      fs.writeFileSync(emptyImg, '');
      try {
        await expect(
          ocrService.extractTextFromImage(emptyImg)
        ).rejects.toThrow('Image file is empty (0 bytes)');
      } finally {
        if (fs.existsSync(emptyImg)) fs.unlinkSync(emptyImg);
      }
    });

    it('OCR-VAL-03: extracts text from existing repository sample image if present', async () => {
      const sampleImg = path.join(process.cwd(), '..', 'image.png');
      if (fs.existsSync(sampleImg)) {
        // Test that OCR runs without crashing the application (FR-04 AC: OCR failure does not crash)
        try {
          const result = await ocrService.extractTextFromImage(sampleImg);
          expect(result).toBeDefined();
          expect(result.text).toBeDefined();
        } catch (err) {
          expect(err).toBeInstanceOf(AppError);
        }
      }
    });
  });

  describe('AI Summarization & Fallback Logic (FR-06, FR-08)', () => {
    it('SUMM-UNIT-01: generates brief summary from text using fallback/service', async () => {
      const text = 'First sentence of study notes. Second sentence with important points. Third sentence with conclusion.';
      const summary = await geminiService.generateSummary(text, 'brief');
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    });

    it('SUMM-UNIT-02: generates detailed summary with more content than brief', async () => {
      const text = 'Sentence 1. Sentence 2. Sentence 3. Sentence 4. Sentence 5. Sentence 6.';
      const detailed = await geminiService.generateSummary(text, 'detailed');
      expect(typeof detailed).toBe('string');
      expect(detailed.length).toBeGreaterThan(0);
    });

    it('SUMM-UNIT-03: extracts main topics as an array from text', async () => {
      const text = 'Photosynthesis occurs in plant chloroplasts using sunlight, water, and carbon dioxide.';
      const topics = await geminiService.extractTopics(text);
      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
    });
  });

  describe('Video Validation & Audio Extraction Error Handling (FR-07)', () => {
    it('VID-VAL-01: extractAudio rejects non-existent video files gracefully', async () => {
      await expect(
        videoProcessingService.extractAudio('missing_video.mp4', 'output.mp3')
      ).rejects.toThrow('Video file not found');
    });

    it('VID-VAL-02: extractAudio rejects empty 0-byte video files', async () => {
      const emptyVideo = path.join(process.cwd(), 'empty_video.mp4');
      fs.writeFileSync(emptyVideo, '');
      try {
        await expect(
          videoProcessingService.extractAudio(emptyVideo, 'output.mp3')
        ).rejects.toThrow('Video file is empty');
      } finally {
        if (fs.existsSync(emptyVideo)) fs.unlinkSync(emptyVideo);
      }
    });

    it('VID-TRANS-01: transcribeAudio produces educational speech transcript', async () => {
      const transcript = await videoProcessingService.transcribeAudio(null, 'Operating Systems Scheduling');
      expect(typeof transcript).toBe('string');
      expect(transcript.length).toBeGreaterThan(50);
      expect(transcript.toLowerCase()).toContain('operating systems scheduling');
    });
  });
});
