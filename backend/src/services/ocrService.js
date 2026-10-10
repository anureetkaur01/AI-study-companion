import fs from 'fs';
import { createWorker } from 'tesseract.js';
import { AppError } from '../middleware/errorHandler.js';

export class OcrService {
  /**
   * Extract text from supported images (PNG, JPG, JPEG, WEBP)
   * @param {string} filePath - Path to image file on disk
   * @returns {Promise<{text: string, confidence: number, charCount: number}>}
   */
  async extractTextFromImage(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      throw new AppError('Image file not found on server', 400);
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new AppError('Image file is empty (0 bytes)', 400);
    }

    let worker = null;
    try {
      worker = await createWorker('eng');
      const ret = await worker.recognize(filePath);
      const extractedText = (ret.data && ret.data.text) ? ret.data.text.trim() : '';

      if (!extractedText || extractedText.length === 0) {
        throw new AppError('No readable text found in image (image may be blank or unclear)', 400);
      }

      console.log(`✅ OCR extracted: ${extractedText.length} characters (confidence: ${ret.data.confidence}%)`);
      return {
        text: extractedText,
        confidence: ret.data.confidence || 0,
        charCount: extractedText.length
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('❌ OCR Processing Error:', error.message);
      throw new AppError(`OCR processing failed: ${error.message}`, 400);
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (termErr) {
          console.warn('⚠️ Worker termination warning:', termErr.message);
        }
      }
    }
  }
}

export default new OcrService();
