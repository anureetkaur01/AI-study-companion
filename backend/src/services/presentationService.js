import pptxgen from 'pptxgenjs';
import { AppError } from '../middleware/errorHandler.js';

export class PresentationService {
  /**
   * Generate downloadable PPTX presentation from structured lecture content
   * @param {object} lecture - Validated Lecture record
   * @returns {Promise<Buffer>}
   */
  async generatePowerPoint(lecture) {
    if (!lecture || !lecture.title) {
      throw new AppError('Cannot generate presentation from empty lecture content', 400);
    }

    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = 'AI Study Companion';
      pptx.company = 'Educational Suite';
      pptx.subject = lecture.topic || lecture.title;
      pptx.title = lecture.title;

      // Slide 1: Professional Title Slide
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: '0F172A' }; // Dark slate navy
      titleSlide.addText(lecture.title, {
        x: 1.0,
        y: 2.2,
        w: 11.3,
        h: 1.6,
        fontSize: 34,
        color: 'FFFFFF',
        bold: true,
        align: 'center'
      });
      titleSlide.addText(`Topic: ${lecture.topic || 'Academic Lecture'} | AI Study Companion`, {
        x: 1.0,
        y: 3.9,
        w: 11.3,
        h: 0.6,
        fontSize: 18,
        color: '94A3B8',
        align: 'center'
      });
      titleSlide.addText(`Generated on ${new Date().toLocaleDateString()}`, {
        x: 1.0,
        y: 4.6,
        w: 11.3,
        h: 0.5,
        fontSize: 14,
        color: '64748B',
        align: 'center'
      });

      // Slide 2: Learning Objectives
      if (Array.isArray(lecture.learningObjectives) && lecture.learningObjectives.length > 0) {
        const objSlide = pptx.addSlide();
        objSlide.background = { color: 'F8FAFC' };
        objSlide.addText('🎯 Learning Objectives', {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 26,
          color: '0F172A',
          bold: true
        });
        const objItems = lecture.learningObjectives.map(obj => ({
          text: obj,
          options: { bullet: true, fontSize: 18, color: '334155' }
        }));
        objSlide.addText(objItems, {
          x: 0.8,
          y: 1.8,
          w: 11.5,
          h: 4.8
        });
      }

      // Slide 3: Introduction
      if (lecture.introduction) {
        const introSlide = pptx.addSlide();
        introSlide.background = { color: 'FFFFFF' };
        introSlide.addText('📖 Introduction & Context', {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 26,
          color: '0F172A',
          bold: true
        });
        introSlide.addText(lecture.introduction, {
          x: 0.8,
          y: 1.8,
          w: 11.5,
          h: 4.8,
          fontSize: 18,
          color: '334155',
          lineSpacing: 28
        });
      }

      // Main Concepts Slides
      if (Array.isArray(lecture.mainConcepts)) {
        lecture.mainConcepts.forEach((concept, idx) => {
          const conceptSlide = pptx.addSlide();
          conceptSlide.background = { color: 'FFFFFF' };
          conceptSlide.addText(`💡 Concept ${idx + 1}: ${concept.title}`, {
            x: 0.8,
            y: 0.8,
            w: 11.5,
            h: 0.8,
            fontSize: 24,
            color: '0F172A',
            bold: true
          });
          conceptSlide.addText(concept.explanation, {
            x: 0.8,
            y: 1.8,
            w: 11.5,
            h: 2.2,
            fontSize: 17,
            color: '334155',
            lineSpacing: 26
          });

          if (Array.isArray(concept.examples) && concept.examples.length > 0) {
            conceptSlide.addText('Practical Examples & Applications:', {
              x: 0.8,
              y: 4.1,
              w: 11.5,
              h: 0.5,
              fontSize: 17,
              color: '0F766E', // Teal
              bold: true
            });
            const exItems = concept.examples.map(ex => ({
              text: ex,
              options: { bullet: true, fontSize: 16, color: '134E4A' }
            }));
            conceptSlide.addText(exItems, {
              x: 0.8,
              y: 4.7,
              w: 11.5,
              h: 2.0
            });
          }
        });
      }

      // Summary Slide
      if (lecture.summary) {
        const sumSlide = pptx.addSlide();
        sumSlide.background = { color: 'F8FAFC' };
        sumSlide.addText('📋 Lecture Summary', {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 26,
          color: '0F172A',
          bold: true
        });
        sumSlide.addText(lecture.summary, {
          x: 0.8,
          y: 1.8,
          w: 11.5,
          h: 4.8,
          fontSize: 18,
          color: '334155',
          lineSpacing: 28
        });
      }

      // Review Questions Slide
      if (Array.isArray(lecture.reviewQuestions) && lecture.reviewQuestions.length > 0) {
        const qSlide = pptx.addSlide();
        qSlide.background = { color: 'FFFFFF' };
        qSlide.addText('❓ Review & Discussion Questions', {
          x: 0.8,
          y: 0.8,
          w: 11.5,
          h: 0.8,
          fontSize: 26,
          color: '0F172A',
          bold: true
        });
        const qItems = lecture.reviewQuestions.map((q, idx) => ({
          text: `${idx + 1}. ${q}`,
          options: { fontSize: 18, color: '1E293B' }
        }));
        qSlide.addText(qItems, {
          x: 0.8,
          y: 1.8,
          w: 11.5,
          h: 4.8
        });
      }

      const buffer = await pptx.write({ outputType: 'nodebuffer' });
      return buffer;
    } catch (error) {
      console.error('❌ PowerPoint generation error:', error.message);
      throw new AppError(`Failed to generate PowerPoint file: ${error.message}`, 500);
    }
  }
}

export default new PresentationService();
