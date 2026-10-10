import express from 'express';
import lectureService from '../services/lectureService.js';
import presentationService from '../services/presentationService.js';
import pdfLectureService from '../services/pdfLectureService.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Require both authentication and teacher role for all teacher routes
router.use(authenticate, authorizeRoles('teacher'));

// Generate structured lecture content
router.post('/lectures/generate', authenticate, async (req, res, next) => {
  try {
    const { topic, contentId, title } = req.body;
    if (!topic && !contentId) {
      throw new AppError('Please specify a lecture topic or select study material', 400);
    }

    const lecture = await lectureService.generateLecture(req.userId, { topic, contentId, title });
    res.status(201).json({ success: true, data: lecture });
  } catch (error) {
    next(error);
  }
});

// List all lectures for the current teacher
router.get('/lectures', authenticate, async (req, res, next) => {
  try {
    const lectures = await lectureService.getTeacherLectures(req.userId);
    res.json({ success: true, data: lectures });
  } catch (error) {
    next(error);
  }
});

// Get lecture by ID
router.get('/lectures/:id', authenticate, async (req, res, next) => {
  try {
    const lecture = await lectureService.getLecture(req.params.id, req.userId);
    res.json({ success: true, data: lecture });
  } catch (error) {
    next(error);
  }
});

// Delete lecture
router.delete('/lectures/:id', authenticate, async (req, res, next) => {
  try {
    const result = await lectureService.deleteLecture(req.params.id, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Download PowerPoint presentation (.pptx)
router.get('/lectures/:id/download-pptx', authenticate, async (req, res, next) => {
  try {
    const lecture = await lectureService.getLecture(req.params.id, req.userId);
    const pptxBuffer = await presentationService.generatePowerPoint(lecture);

    const safeTitle = (lecture.title || 'lecture').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pptx"`);
    res.setHeader('Content-Length', pptxBuffer.length);
    res.send(pptxBuffer);
  } catch (error) {
    next(error);
  }
});

// Download PDF lecture handout (.pdf)
router.get('/lectures/:id/download-pdf', authenticate, async (req, res, next) => {
  try {
    const lecture = await lectureService.getLecture(req.params.id, req.userId);
    const pdfBuffer = await pdfLectureService.generatePdfNotes(lecture);

    const safeTitle = (lecture.title || 'lecture').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

export default router;
