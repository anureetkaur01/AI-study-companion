import Content from '../models/Content.js';
import geminiService from './geminiService.js';
import { AppError } from '../middleware/errorHandler.js';

export class ContentService {
  async uploadContent(userId, title, text, contentType = 'text', extra = {}) {
    if (!title || !title.trim()) {
      throw new AppError('Title is required', 400);
    }

    const content = new Content({
      userId,
      title: title.trim(),
      originalText: text || '',
      fileType: contentType,
      type: contentType,
      ...extra
    });

    // Extract topics if text is provided
    if (text && text.trim().length > 0) {
      content.topics = await geminiService.extractTopics(text);
    } else {
      content.topics = ['General'];
    }

    await content.save();
    return content;
  }

  async generateSummaries(contentId, userId) {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new AppError('Content not found', 404);
    }

    if (userId && content.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized: Access to this material is denied', 403);
    }

    const textToSummarize = content.originalText || content.transcript || '';
    if (!textToSummarize.trim()) {
      throw new AppError('No text available to summarize', 400);
    }

    content.summaries = content.summaries || {};
    content.summaries.brief = await geminiService.generateSummary(textToSummarize, 'brief');
    content.summaries.detailed = await geminiService.generateSummary(textToSummarize, 'detailed');
    content.summaries.comprehensive = await geminiService.generateSummary(textToSummarize, 'comprehensive');

    // Generate structured key points
    content.keyPoints = [
      content.summaries.brief,
      ...content.summaries.detailed.split('.').filter(s => s.trim().length > 10).slice(0, 4).map(s => s.trim())
    ];

    content.updatedAt = new Date();
    await content.save();
    return content;
  }

  async deleteContent(contentId, userId) {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new AppError('Content not found', 404);
    }

    if (content.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized: You cannot delete another user\'s material', 403);
    }

    await Content.findByIdAndDelete(contentId);
    return { id: contentId, message: 'Material successfully deleted' };
  }

  async getContent(contentId, userId) {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new AppError('Content not found', 404);
    }
    if (content.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized: Access to this material is denied', 403);
    }
    return content;
  }

  async getUserContents(userId) {
    return Content.find({ userId }).sort({ createdAt: -1 });
  }

  async toggleBookmark(contentId, userId) {
    const content = await Content.findById(contentId);
    if (!content) {
      throw new AppError('Content not found', 404);
    }
    if (content.userId.toString() !== userId.toString()) {
      throw new AppError('Unauthorized: Access to this material is denied', 403);
    }

    content.bookmarked = !content.bookmarked;
    await content.save();
    return content;
  }
}

export default new ContentService();
