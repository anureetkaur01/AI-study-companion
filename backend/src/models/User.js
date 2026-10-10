import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true, lowercase: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  xp: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastStudyDate: { type: Date },
  totalQuizzesTaken: { type: Number, default: 0 },
  averageAccuracy: { type: Number, default: 0 },
  studentProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentProfile'
  },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model('User', userSchema);
