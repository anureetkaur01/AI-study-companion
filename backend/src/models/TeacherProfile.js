import mongoose from 'mongoose';

const teacherProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    // Basic Info
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    username: { type: String, lowercase: true, trim: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },

    // Professional & Academic Info
    institution: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    designation: {
      type: String,
      default: 'Instructor',
      trim: true
    },
    expertise: [{ type: String, trim: true }],
    officeLocation: { type: String, default: '', trim: true },
    officeHours: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },

    // Social & Professional Links
    socialLinks: {
      linkedin: { type: String, default: '' },
      github: { type: String, default: '' },
      twitter: { type: String, default: '' },
      scholar: { type: String, default: '' }
    },

    // Stats
    totalLecturesUploaded: { type: Number, default: 0 },
    totalMaterialsUploaded: { type: Number, default: 0 },
    totalStudentsReached: { type: Number, default: 0 },

    // Follow system (store user IDs)
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],

    isPublic: { type: Boolean, default: true },
    lastActiveAt: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

teacherProfileSchema.index({ username: 1 });
teacherProfileSchema.index({ email: 1 });
teacherProfileSchema.index({ department: 1 });

export default mongoose.model('TeacherProfile', teacherProfileSchema);
