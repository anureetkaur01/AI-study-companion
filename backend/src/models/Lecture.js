import mongoose from 'mongoose';

const lectureConceptSchema = new mongoose.Schema({
  title: { type: String, required: true },
  explanation: { type: String, required: true },
  examples: [String]
}, { _id: false });

const lectureSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceContentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
  title: { type: String, required: true },
  topic: { type: String, required: true },
  learningObjectives: [{ type: String, required: true }],
  introduction: { type: String, required: true },
  mainConcepts: [lectureConceptSchema],
  summary: { type: String, required: true },
  reviewQuestions: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Lecture', lectureSchema);
