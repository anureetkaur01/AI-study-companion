import PDFDocument from 'pdfkit';
import { AppError } from '../middleware/errorHandler.js';

export class PdfLectureService {
  /**
   * Generate downloadable PDF lecture notes from structured lecture content
   * @param {object} lecture - Validated Lecture record
   * @returns {Promise<Buffer>}
   */
  async generatePdfNotes(lecture) {
    if (!lecture || !lecture.title) {
      throw new AppError('Cannot generate PDF from empty lecture content', 400);
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          size: 'A4',
          info: {
            Title: lecture.title,
            Author: 'AI Study Companion',
            Subject: lecture.topic || 'Lecture Handout'
          }
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(new AppError(`PDF generation stream error: ${err.message}`, 500)));

        // Header Banner
        doc.rect(50, 45, 495, 4).fill('#2563EB'); // Primary blue stripe
        doc.moveDown(0.8);

        // Lecture Title
        doc.fontSize(24).font('Helvetica-Bold').fillColor('#0F172A').text(lecture.title, { align: 'left' });
        doc.moveDown(0.3);

        // Metadata Subtitle
        doc.fontSize(11).font('Helvetica').fillColor('#64748B')
          .text(`Topic: ${lecture.topic || 'General'}   |   Generated: ${new Date().toLocaleDateString()}   |   AI Study Companion`);
        doc.moveDown(1.2);

        // Horizontal Separator
        doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Section: Learning Objectives
        if (Array.isArray(lecture.learningObjectives) && lecture.learningObjectives.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A').text('1. Learning Objectives');
          doc.moveDown(0.5);
          doc.fontSize(10.5).font('Helvetica').fillColor('#334155');
          lecture.learningObjectives.forEach(obj => {
            doc.text(`•  ${obj}`, { indent: 15, lineGap: 3 });
          });
          doc.moveDown(1);
        }

        // Section: Introduction
        if (lecture.introduction) {
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A').text('2. Introduction & Background');
          doc.moveDown(0.5);
          doc.fontSize(10.5).font('Helvetica').fillColor('#334155')
            .text(lecture.introduction, { lineGap: 4, align: 'justify' });
          doc.moveDown(1);
        }

        // Section: Main Concepts
        if (Array.isArray(lecture.mainConcepts) && lecture.mainConcepts.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A').text('3. Core Concepts & Explanations');
          doc.moveDown(0.5);

          lecture.mainConcepts.forEach((concept, idx) => {
            // Check for page break if near bottom
            if (doc.y > 680) doc.addPage();

            doc.fontSize(12).font('Helvetica-Bold').fillColor('#0F172A')
              .text(`3.${idx + 1}  ${concept.title}`);
            doc.moveDown(0.3);

            doc.fontSize(10.5).font('Helvetica').fillColor('#334155')
              .text(concept.explanation, { indent: 10, lineGap: 3, align: 'justify' });
            doc.moveDown(0.4);

            if (Array.isArray(concept.examples) && concept.examples.length > 0) {
              doc.fontSize(10).font('Helvetica-Bold').fillColor('#0D9488').text('Examples:', { indent: 10 });
              doc.fontSize(10).font('Helvetica').fillColor('#134E4A');
              concept.examples.forEach(ex => {
                doc.text(`- ${ex}`, { indent: 20, lineGap: 2 });
              });
              doc.moveDown(0.6);
            }
          });
          doc.moveDown(0.8);
        }

        // Section: Summary
        if (lecture.summary) {
          if (doc.y > 660) doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A').text('4. Summary & Conclusions');
          doc.moveDown(0.5);
          doc.fontSize(10.5).font('Helvetica').fillColor('#334155')
            .text(lecture.summary, { lineGap: 4, align: 'justify' });
          doc.moveDown(1);
        }

        // Section: Review Questions
        if (Array.isArray(lecture.reviewQuestions) && lecture.reviewQuestions.length > 0) {
          if (doc.y > 660) doc.addPage();
          doc.fontSize(14).font('Helvetica-Bold').fillColor('#1E3A8A').text('5. Review & Discussion Questions');
          doc.moveDown(0.5);
          doc.fontSize(10.5).font('Helvetica').fillColor('#1E293B');
          lecture.reviewQuestions.forEach((q, idx) => {
            doc.text(`${idx + 1}.  ${q}`, { indent: 15, lineGap: 3 });
          });
          doc.moveDown(1.5);
        }

        // Footer note
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#94A3B8')
          .text('Generated with AI Study Companion for educational verification and classroom instruction.', { align: 'center' });

        doc.end();
      } catch (err) {
        reject(new AppError(`Failed to generate PDF: ${err.message}`, 500));
      }
    });
  }
}

export default new PdfLectureService();
