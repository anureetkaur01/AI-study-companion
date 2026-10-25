import express from 'express';
import contentService from '../services/contentService.js';
import youtubeService from '../services/youtubeService.js';
import fileExtractionService from '../services/fileExtractionService.js';
import videoProcessingService from '../services/videoProcessingService.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/multerConfig.js';
import { AppError } from '../middleware/errorHandler.js';
import axios from 'axios';
import Content from '../models/Content.js';
import fs from 'fs';
import pdfParse from 'pdf-parse';

const router = express.Router();

// Helper function to extract YouTube video ID
function extractYouTubeVideoId(url) {
  let videoId = '';
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1]?.split('&')[0] || '';
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
  }
  return videoId;
}

// Helper function to get YouTube video info
async function getYouTubeInfo(videoId) {
  try {
    // Try to get video info from noembed API (no auth needed)
    const response = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching YouTube info:', error.message);
    return null;
  }
}

router.post('/upload', authenticate, async (req, res, next) => {
  try {
    const { title, text, pdfUrl, youtubeUrl, type, fileType } = req.body;
    
    if (!title) {
      throw new AppError('Missing title', 400);
    }

    let contentText = '';
    let contentType = type || fileType || 'text';
    let finalTitle = title;

    console.log(`📤 Uploading content - Type: ${contentType}, Title: ${title}`);

    // Handle PDF URL
    if (contentType === 'pdf') {
      if (!pdfUrl || !pdfUrl.trim()) {
        throw new AppError('Missing PDF URL', 400);
      }
      try {
        const pdfRes = await axios.get(pdfUrl.trim(), { responseType: 'arraybuffer', timeout: 8000 });
        const pdfData = await pdfParse(Buffer.from(pdfRes.data));
        if (pdfData && pdfData.text && pdfData.text.trim().length > 30) {
          contentText = pdfData.text;
          console.log(`✅ Extracted ${contentText.length} characters from PDF URL`);
        } else {
          contentText = `PDF Document: ${title}\nURL: ${pdfUrl}`;
        }
      } catch (pdfErr) {
        console.warn('⚠️ Could not extract text directly from PDF URL, using title context:', pdfErr.message);
        contentText = `PDF Document: ${title}\nURL: ${pdfUrl}\nTopic: ${title}`;
      }
    }
    // Handle YouTube URL
    else if (contentType === 'youtube') {
      if (!youtubeUrl || !youtubeUrl.trim()) {
        throw new AppError('Missing YouTube URL', 400);
      }
      
      try {
        // Try to extract full content using YouTube API
        const youtubeContent = await youtubeService.getFullContent(youtubeUrl);
        finalTitle = youtubeContent.title;
        contentText = youtubeContent.content;
        console.log('✅ YouTube content extracted successfully');
      } catch (error) {
        console.warn('⚠️ YouTube content extraction failed, using fallback:', error.message);
        
        // Fallback: Use video ID and noembed API
        const videoId = extractYouTubeVideoId(youtubeUrl);
        if (!videoId) {
          throw new AppError('Invalid YouTube URL', 400);
        }

        const videoInfo = await getYouTubeInfo(videoId);
        if (videoInfo && videoInfo.title) {
          finalTitle = videoInfo.title;
        }

        contentText = `YouTube Video: ${finalTitle}\n\nVideo URL: ${youtubeUrl}\n\nNote: Using video title and description for quiz generation.`;
      }
    }
    // Handle Text
    else {
      if (!text || !text.trim()) {
        throw new AppError('Missing content text', 400);
      }
      contentText = text;
    }

    const content = await contentService.uploadContent(req.userId, finalTitle, contentText, contentType);
    console.log(`✅ Content uploaded successfully - ID: ${content._id}, Type: ${content.type}`);
    res.status(201).json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

// Comprehensive file upload endpoint (PDF, DOCX, TXT, Images, MP4 Videos)
router.post('/upload-file', authenticate, upload.single('file'), async (req, res, next) => {
  let filePath = null;
  let keepFile = false;
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const { title } = req.body;
    if (!title || !title.trim()) {
      throw new AppError('Missing title', 400);
    }

    filePath = req.file.path;
    const fileType = req.file.mimetype;
    const fileName = req.file.originalname;
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

    console.log(`📄 Processing file upload: ${fileName} (${ext})`);

    // Validate file
    fileExtractionService.validateFileType(fileName);
    fileExtractionService.validateFileSize(req.file.size);

    // Case 1: Video Files (MP4, M4V, WEBM) -> Asynchronous Background Processing
    if (['.mp4', '.m4v', '.webm'].includes(ext)) {
      keepFile = true; // Retain file until background transcription finishes
      const content = await contentService.uploadContent(
        req.userId,
        title.trim(),
        'Video upload received. Speech-to-text transcription is currently running in the background...',
        'video',
        {
          transcriptionStatus: 'processing',
          mediaUrl: filePath
        }
      );

      // Trigger background audio extraction & Whisper transcription asynchronously
      videoProcessingService.processVideoJob(content._id, filePath, title.trim())
        .catch(err => console.error('Background transcription error:', err));

      return res.status(201).json({
        success: true,
        data: {
          ...content.toObject(),
          fileName: fileName,
          status: 'processing'
        },
        message: 'Video uploaded. Audio extraction and speech-to-text transcription started in the background.'
      });
    }

    // Case 2: Document or Image (OCR)
    const extractedText = await fileExtractionService.extractText(filePath, fileType);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new AppError('Could not extract text from file (file may be blank, corrupt, or unreadable)', 400);
    }

    let contentType = 'text';
    if (ext === '.pdf') contentType = 'pdf';
    else if (ext === '.docx' || ext === '.doc') contentType = 'docx';
    else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) contentType = 'image';

    const content = await contentService.uploadContent(
      req.userId,
      title.trim(),
      extractedText,
      contentType
    );

    console.log(`✅ File processed successfully - ID: ${content._id}, Type: ${contentType}`);
    res.status(201).json({
      success: true,
      data: {
        ...content.toObject(),
        extractedCharacters: extractedText.length,
        fileName: fileName
      }
    });
  } catch (error) {
    if (filePath && !keepFile) {
      await fileExtractionService.cleanupFile(filePath);
    }
    next(error);
  } finally {
    if (filePath && !keepFile) {
      setTimeout(() => {
        fileExtractionService.cleanupFile(filePath);
      }, 1000);
    }
  }
});

// Check video transcription status
router.get('/:id/transcription-status', authenticate, async (req, res, next) => {
  try {
    const content = await contentService.getContent(req.params.id, req.userId);
    res.json({
      success: true,
      data: {
        id: content._id,
        status: content.transcriptionStatus || 'none',
        hasTranscript: !!content.transcript,
        transcript: content.transcript || '',
        summaries: content.summaries
      }
    });
  } catch (error) {
    next(error);
  }
});

// Summarize content
router.post('/:id/summarize', authenticate, async (req, res, next) => {
  try {
    const content = await contentService.generateSummaries(req.params.id, req.userId);
    res.json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

// Regenerate summary explicitly (FR-06)
router.post('/:id/regenerate-summary', authenticate, async (req, res, next) => {
  try {
    const content = await contentService.generateSummaries(req.params.id, req.userId);
    res.json({ success: true, data: content, message: 'Summary successfully regenerated' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await contentService.deleteContent(req.params.id, req.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const content = await contentService.getContent(req.params.id, req.userId);
    res.json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const contents = await contentService.getUserContents(req.userId);
    res.json({ success: true, data: contents });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/bookmark', authenticate, async (req, res, next) => {
  try {
    const content = await contentService.toggleBookmark(req.params.id, req.userId);
    res.json({ success: true, data: content });
  } catch (error) {
    next(error);
  }
});

// Test endpoint to see content types
router.get('/debug/check-types', authenticate, async (req, res, next) => {
  try {
    const contents = await Content.find({ userId: req.userId });
    const summary = {
      total: contents.length,
      withType: contents.filter(c => c.type).length,
      withoutType: contents.filter(c => !c.type).length,
      byType: {
        text: contents.filter(c => c.type === 'text').length,
        pdf: contents.filter(c => c.type === 'pdf').length,
        youtube: contents.filter(c => c.type === 'youtube').length,
        undefined: contents.filter(c => !c.type).length
      },
      samples: contents.slice(0, 3).map(c => ({
        _id: c._id,
        title: c.title,
        type: c.type,
        fileType: c.fileType
      }))
    };
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

// Migration endpoint - fix existing content types (aggressive)
router.post('/migrate/fix-types', async (req, res, next) => {
  try {
    // First, update all documents that don't have a type field
    const result1 = await Content.updateMany(
      { type: { $exists: false } },
      { $set: { type: 'text' } }
    );
    
    // Second, update all documents where type is null or empty
    const result2 = await Content.updateMany(
      { $or: [{ type: null }, { type: '' }] },
      { $set: { type: 'text' } }
    );

    // Third, sync fileType to type if they differ
    const result3 = await Content.updateMany(
      { fileType: { $exists: true }, $expr: { $ne: ['$fileType', '$type'] } },
      [{ $set: { type: '$fileType' } }]
    );

    const total = result1.modifiedCount + result2.modifiedCount + result3.modifiedCount;
    console.log(`✅ Migration complete: Updated ${total} documents`);
    console.log(`  - Missing type field: ${result1.modifiedCount}`);
    console.log(`  - Null/empty type: ${result2.modifiedCount}`);
    console.log(`  - Synced fileType: ${result3.modifiedCount}`);
    
    res.json({ 
      success: true, 
      message: `Updated ${total} documents with type field`,
      details: {
        missingType: result1.modifiedCount,
        nullType: result2.modifiedCount,
        syncedFileType: result3.modifiedCount
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
    next(error);
  }
});

// Smart migration - detect content type from content
router.post('/migrate/smart-fix', async (req, res, next) => {
  try {
    const allContent = await Content.find({});
    let updated = 0;

    for (const content of allContent) {
      let detectedType = 'text';
      
      // Detect YouTube content
      if (content.youtubeUrl || content.originalText?.includes('YouTube Video:')) {
        detectedType = 'youtube';
      }
      // Detect PDF content
      else if (content.pdfUrl || content.originalText?.includes('PDF Document:')) {
        detectedType = 'pdf';
      }
      
      // Update if type is missing or wrong
      if (!content.type || content.type !== detectedType) {
        await Content.updateOne(
          { _id: content._id },
          { $set: { type: detectedType } }
        );
        updated++;
        console.log(`Updated: ${content.title} → ${detectedType}`);
      }
    }

    console.log(`✅ Smart migration complete: Updated ${updated} documents`);
    res.json({ 
      success: true, 
      message: `Smart migration updated ${updated} documents`,
      updated
    });
  } catch (error) {
    console.error('Smart migration error:', error);
    next(error);
  }
});

// Test YouTube API endpoint
router.get('/test/youtube-api', async (req, res, next) => {
  try {
    const youtubeUrl = req.query.url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    
    console.log('🧪 Testing YouTube API with URL:', youtubeUrl);
    
    const result = await youtubeService.getFullContent(youtubeUrl);
    
    res.json({
      success: true,
      message: 'YouTube content extraction is working!',
      data: {
        title: result.title,
        hasTranscript: !!result.transcript,
        transcriptLength: result.transcript ? result.transcript.length : 0,
        descriptionLength: result.description ? result.description.length : 0,
        contentPreview: result.content.substring(0, 500)
      }
    });
  } catch (error) {
    console.error('❌ YouTube content extraction failed:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      hint: 'Make sure the YouTube URL is valid. Transcript extraction requires OAuth setup.'
    });
  }
});

export default router;
