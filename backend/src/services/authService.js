import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateEmail, validatePassword, validateRole } from '../utils/validators.js';

export class AuthService {
  async register(name, email, password, role = 'student') {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('Name is required', 400);
    }

    if (!validateEmail(email)) {
      throw new AppError('Invalid email format', 400);
    }

    if (!validatePassword(password)) {
      throw new AppError('Password must be between 6 and 128 characters', 400);
    }

    const assignedRole = validateRole(role) || 'student';

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole
    });
    await user.save();

    // Create student profile for tracking if student
    if (assignedRole === 'student') {
      const profile = new StudentProfile({
        userId: user._id,
        name: user.name,
        email: user.email,
        username: user.username
      });
      await profile.save();
      user.studentProfile = profile._id;
      await user.save();
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'study_companion_secret_key',
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      },
      token
    };
  }

  async login(email, password) {
    if (!validateEmail(email)) {
      throw new AppError('Invalid email format', 400);
    }

    if (!password) {
      throw new AppError('Missing email or password', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role || 'student' },
      process.env.JWT_SECRET || 'study_companion_secret_key',
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role || 'student'
      },
      token
    };
  }

  async getProfile(userId) {
    const user = await User.findById(userId).select('-password').populate('studentProfile');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return user;
  }
}

export default new AuthService();
