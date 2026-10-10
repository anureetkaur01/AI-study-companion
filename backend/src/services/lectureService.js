import Lecture from '../models/Lecture.js';
import Content from '../models/Content.js';
import geminiService from './geminiService.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateLectureContentStructure } from '../utils/validators.js';

export class LectureService {
  /**
   * Generate structured lecture content from a topic or uploaded study material
   * @param {string} userId
   * @param {object} param1 - { topic, contentId, title }
   */
  async generateLecture(userId, { topic, contentId, title }) {
    let sourceText = '';
    let lectureTitle = title;
    let lectureTopic = topic;

    if (contentId) {
      const content = await Content.findById(contentId);
      if (!content) {
        throw new AppError('Source content not found', 404);
      }
      sourceText = content.originalText || content.transcript || content.title;
      if (!lectureTitle) lectureTitle = content.title;
      if (!lectureTopic) lectureTopic = (content.topics && content.topics[0]) || content.title;
    } else if (topic && topic.trim()) {
      sourceText = topic.trim();
      if (!lectureTitle) lectureTitle = topic.trim();
      lectureTopic = topic.trim();
    } else {
      throw new AppError('A lecture topic or source study material is required', 400);
    }

    if (!lectureTitle || !lectureTitle.trim()) {
      lectureTitle = 'Lecture Presentation';
    }

    // Call AI service to generate structured content
    const structuredContent = await geminiService.generateLectureContent(sourceText, lectureTitle.trim());

    if (!validateLectureContentStructure(structuredContent)) {
      throw new AppError('Generated lecture structure is invalid', 500);
    }

    // Save to database
    const lecture = new Lecture({
      userId,
      sourceContentId: contentId || null,
      title: structuredContent.title || lectureTitle,
      topic: lectureTopic || 'General',
      learningObjectives: structuredContent.learningObjectives,
      introduction: structuredContent.introduction,
      mainConcepts: structuredContent.mainConcepts,
      summary: structuredContent.summary,
      reviewQuestions: structuredContent.reviewQuestions || []
    });

    await lecture.save();
    return lecture;
  }

  async getLecture(lectureId, userId) {
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      throw new AppError('Lecture material not found', 404);
    }
    if (lecture.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized access to private lecture material', 403);
    }
    return lecture;
  }

  async getTeacherLectures(userId) {
    return Lecture.find({ userId }).sort({ createdAt: -1 });
  }

  async deleteLecture(lectureId, userId) {
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) {
      throw new AppError('Lecture material not found', 404);
    }
    if (lecture.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized: You cannot delete this lecture', 403);
    }
    await Lecture.findByIdAndDelete(lectureId);
    return { id: lectureId, message: 'Lecture deleted successfully' };
  }
}

export default new LectureService();
