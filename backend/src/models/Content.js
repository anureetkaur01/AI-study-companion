import mongoose from 'mongoose';

const contentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  originalText: { type: String, default: '' },
  fileType: { type: String, enum: ['text', 'pdf', 'docx', 'doc', 'image', 'video', 'youtube'], default: 'text' },
  type: { type: String, enum: ['text', 'pdf', 'docx', 'doc', 'image', 'video', 'youtube'], default: 'text' },
  pdfUrl: String,
  youtubeUrl: String,
  mediaUrl: String,
  transcript: String,
  transcriptionStatus: {
    type: String,
    enum: ['none', 'pending', 'processing', 'completed', 'failed'],
    default: 'none'
  },
  summaries: {
    brief: String,
    detailed: String,
    comprehensive: String
  },
  keyPoints: [String],
  topics: [String],
  bookmarked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Content', contentSchema);
