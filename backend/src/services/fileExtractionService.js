import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import ocrService from './ocrService.js';
import { AppError } from '../middleware/errorHandler.js';

export class FileExtractionService {
  async extractTextFromPDF(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new AppError('File not found', 400);
      }
      const fileBuffer = fs.readFileSync(filePath);
      if (fileBuffer.length === 0) {
        throw new AppError('PDF document is empty (0 bytes)', 400);
      }
      const data = await pdfParse(fileBuffer);
      
      const text = data.text || '';
      if (!text || text.trim().length === 0) {
        throw new AppError('No text could be extracted from PDF (file may be scanned/blank)', 400);
      }
      
      console.log(`✅ PDF extracted: ${text.length} characters from ${data.numpages} pages`);
      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('❌ PDF extraction error:', error.message);
      throw new AppError(`Failed to extract PDF: ${error.message}`, 400);
    }
  }

  async extractTextFromDOCX(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new AppError('File not found', 400);
      }
      const fileBuffer = fs.readFileSync(filePath);
      if (fileBuffer.length === 0) {
        throw new AppError('DOCX document is empty (0 bytes)', 400);
      }
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const text = result.value || '';
      
      if (!text || text.trim().length === 0) {
        throw new AppError('No text could be extracted from DOCX', 400);
      }
      
      console.log(`✅ DOCX extracted: ${text.length} characters`);
      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('❌ DOCX extraction error:', error.message);
      throw new AppError(`Failed to extract DOCX: ${error.message}`, 400);
    }
  }

  async extractTextFromTXT(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new AppError('File not found', 400);
      }
      const text = fs.readFileSync(filePath, 'utf-8');
      
      if (!text || text.trim().length === 0) {
        throw new AppError('Text file is empty', 400);
      }
      
      console.log(`✅ TXT extracted: ${text.length} characters`);
      return text;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('❌ TXT extraction error:', error.message);
      throw new AppError(`Failed to extract TXT: ${error.message}`, 400);
    }
  }

  async extractText(filePath, fileType) {
    const ext = path.extname(filePath).toLowerCase();
    console.log(`📄 Extracting text from ${fileType} file: ${ext}`);
    
    switch (ext) {
      case '.pdf':
        return await this.extractTextFromPDF(filePath);
      case '.docx':
      case '.doc':
        return await this.extractTextFromDOCX(filePath);
      case '.txt':
        return await this.extractTextFromTXT(filePath);
      case '.png':
      case '.jpg':
      case '.jpeg':
      case '.webp': {
        const ocrResult = await ocrService.extractTextFromImage(filePath);
        return ocrResult.text;
      }
      default:
        throw new AppError(`Unsupported file type: ${ext}. Supported: PDF, DOCX, DOC, TXT, PNG, JPG, JPEG, WEBP`, 400);
    }
  }

  async cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      console.error('⚠️ Error cleaning up file:', error.message);
    }
  }

  validateFileSize(fileSize, maxSizeMB = 50) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (fileSize > maxBytes) {
      throw new AppError(`File size exceeds ${maxSizeMB}MB limit`, 400);
    }
  }

  validateFileType(filename) {
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.mp4'];
    const ext = path.extname(filename).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      throw new AppError(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`, 400);
    }
  }
}

export default new FileExtractionService();
