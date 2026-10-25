import StudentProfile from '../models/StudentProfile.js';
import TeacherProfile from '../models/TeacherProfile.js';
import User from '../models/User.js';
import Lecture from '../models/Lecture.js';
import Content from '../models/Content.js';

const populateFollowData = {
  path: 'followers',
  model: 'User',
  select: 'name username avatar role'
};

const populateFollowingData = {
  path: 'following',
  model: 'User',
  select: 'name username avatar role'
};

/**
 * Helper to get the correct profile model based on role
 */
const getProfileModel = (role) => {
  return role === 'teacher' ? TeacherProfile : StudentProfile;
};

/**
 * Create or retrieve profile for a user
 */
export const createOrGetProfile = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const role = user.role || 'student';

    if (role === 'teacher') {
      let profile = await TeacherProfile.findOne({ userId })
        .populate(populateFollowData)
        .populate(populateFollowingData);

      const [lecturesCount, materialsCount] = await Promise.all([
        Lecture.countDocuments({ userId }).catch(() => 0),
        Content.countDocuments({ userId }).catch(() => 0)
      ]);

      if (!profile) {
        profile = new TeacherProfile({
          userId,
          name: user.name,
          email: user.email,
          username: user.username,
          totalLecturesUploaded: lecturesCount,
          totalMaterialsUploaded: materialsCount
        });
        await profile.save();

        user.teacherProfile = profile._id;
        await user.save();
      } else {
        // Sync live counts
        profile.totalLecturesUploaded = lecturesCount;
        profile.totalMaterialsUploaded = materialsCount;
        await profile.save();
      }

      return { ...profile.toObject(), role: 'teacher' };
    }

    // Default: Student Profile
    let profile = await StudentProfile.findOne({ userId })
      .populate(populateFollowData)
      .populate(populateFollowingData);

    if (!profile) {
      profile = new StudentProfile({
        userId,
        name: user.name,
        email: user.email,
        username: user.username,
        totalXP: user.xp || 0,
        currentStreak: user.streak || 0,
        totalQuizzesTaken: user.totalQuizzesTaken || 0,
        averageAccuracy: user.averageAccuracy || 0
      });
      await profile.save();

      user.studentProfile = profile._id;
      await user.save();
    }

    return { ...profile.toObject(), role: 'student' };
  } catch (error) {
    throw new Error(`Failed to create or get profile: ${error.message}`);
  }
};

/**
 * Get profile by user ID
 */
export const getProfileByUserId = async (userId) => {
  return await createOrGetProfile(userId);
};

/**
 * Get profile by username (student or teacher)
 */
export const getProfileByUsername = async (username) => {
  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return null;
    }

    return await createOrGetProfile(user._id);
  } catch (error) {
    throw new Error(`Failed to get profile by username: ${error.message}`);
  }
};

/**
 * Update profile for student or teacher
 */
export const updateProfile = async (userId, updateData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // If name is updated, sync User model
    if (updateData.name && updateData.name.trim() !== user.name) {
      user.name = updateData.name.trim();
      await user.save();
    }

    const role = user.role || 'student';

    if (role === 'teacher') {
      // Process expertise tags if provided as string
      let expertise = updateData.expertise;
      if (typeof expertise === 'string') {
        expertise = expertise
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }

      const teacherFields = {
        name: updateData.name?.trim() || user.name,
        bio: updateData.bio ?? '',
        avatar: updateData.avatar ?? '',
        institution: updateData.institution?.trim() ?? '',
        department: updateData.department?.trim() ?? '',
        designation: updateData.designation?.trim() ?? 'Instructor',
        officeLocation: updateData.officeLocation?.trim() ?? '',
        officeHours: updateData.officeHours?.trim() ?? '',
        website: updateData.website?.trim() ?? '',
        socialLinks: {
          linkedin: updateData.socialLinks?.linkedin ?? '',
          github: updateData.socialLinks?.github ?? '',
          twitter: updateData.socialLinks?.twitter ?? '',
          scholar: updateData.socialLinks?.scholar ?? ''
        },
        isPublic: updateData.isPublic !== undefined ? updateData.isPublic : true,
        lastActiveAt: new Date()
      };

      if (expertise !== undefined) {
        teacherFields.expertise = expertise;
      }

      const profile = await TeacherProfile.findOneAndUpdate(
        { userId },
        { $set: teacherFields },
        { new: true, upsert: true, runValidators: true }
      )
        .populate(populateFollowData)
        .populate(populateFollowingData);

      return { ...profile.toObject(), role: 'teacher' };
    }

    // Student Profile update
    const studentFields = {
      name: updateData.name?.trim() || user.name,
      bio: updateData.bio ?? '',
      avatar: updateData.avatar ?? '',
      school: updateData.school?.trim() ?? '',
      grade: updateData.grade?.trim() ?? '',
      major: updateData.major?.trim() ?? '',
      learningStyle: updateData.learningStyle || 'Mixed',
      preferences: updateData.preferences || {},
      socialLinks: {
        linkedin: updateData.socialLinks?.linkedin ?? '',
        github: updateData.socialLinks?.github ?? '',
        twitter: updateData.socialLinks?.twitter ?? ''
      },
      isPublic: updateData.isPublic !== undefined ? updateData.isPublic : true,
      lastActiveAt: new Date()
    };

    const profile = await StudentProfile.findOneAndUpdate(
      { userId },
      { $set: studentFields },
      { new: true, upsert: true, runValidators: true }
    )
      .populate(populateFollowData)
      .populate(populateFollowingData);

    return { ...profile.toObject(), role: 'student' };
  } catch (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

/**
 * Update profile study statistics (for students)
 */
export const updateProfileStats = async (userId, stats) => {
  try {
    const profile = await StudentProfile.findOneAndUpdate(
      { userId },
      {
        totalStudyHours: stats.totalStudyHours || 0,
        totalQuizzesTaken: stats.totalQuizzesTaken || 0,
        averageAccuracy: stats.averageAccuracy || 0,
        currentStreak: stats.currentStreak || 0,
        longestStreak: stats.longestStreak || 0,
        totalXP: stats.totalXP || 0,
        topicsStudied: stats.topicsStudied || 0,
        topicsMastered: stats.topicsMastered || 0,
        averageQuizScore: stats.averageQuizScore || 0,
        lastActiveAt: new Date()
      },
      { new: true }
    );

    return profile;
  } catch (error) {
    throw new Error(`Failed to update profile stats: ${error.message}`);
  }
};

/**
 * Follow another user (student or teacher)
 */
export const followUser = async (followerId, followingId) => {
  try {
    const [followerUser, followingUser] = await Promise.all([
      User.findById(followerId),
      User.findById(followingId)
    ]);

    if (!followerUser || !followingUser) {
      throw new Error('User not found');
    }

    const FollowerModel = getProfileModel(followerUser.role);
    const FollowingModel = getProfileModel(followingUser.role);

    const followerProfile = await FollowerModel.findOne({ userId: followerId });
    const followingProfile = await FollowingModel.findOne({ userId: followingId });

    if (!followerProfile || !followingProfile) {
      throw new Error('One or both profiles not found');
    }

    if (!followerProfile.following.some((id) => id.toString() === followingId.toString())) {
      followerProfile.following.push(followingId);
      await followerProfile.save();
    }

    if (!followingProfile.followers.some((id) => id.toString() === followerId.toString())) {
      followingProfile.followers.push(followerId);
      await followingProfile.save();
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to follow user: ${error.message}`);
  }
};

/**
 * Unfollow another user
 */
export const unfollowUser = async (followerId, followingId) => {
  try {
    const [followerUser, followingUser] = await Promise.all([
      User.findById(followerId),
      User.findById(followingId)
    ]);

    if (!followerUser || !followingUser) {
      throw new Error('User not found');
    }

    const FollowerModel = getProfileModel(followerUser.role);
    const FollowingModel = getProfileModel(followingUser.role);

    const followerProfile = await FollowerModel.findOne({ userId: followerId });
    const followingProfile = await FollowingModel.findOne({ userId: followingId });

    if (!followerProfile || !followingProfile) {
      throw new Error('One or both profiles not found');
    }

    followerProfile.following = followerProfile.following.filter(
      (id) => id.toString() !== followingId.toString()
    );
    await followerProfile.save();

    followingProfile.followers = followingProfile.followers.filter(
      (id) => id.toString() !== followerId.toString()
    );
    await followingProfile.save();

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to unfollow user: ${error.message}`);
  }
};

/**
 * Unlock badge for student
 */
export const unlockBadge = async (userId, badge) => {
  try {
    const profile = await StudentProfile.findOne({ userId });
    if (!profile) return null;

    const badgeExists = profile.badges.some((b) => b.name === badge.name);
    if (!badgeExists) {
      profile.badges.push({
        ...badge,
        unlockedAt: new Date()
      });
      await profile.save();
    }

    return profile;
  } catch (error) {
    throw new Error(`Failed to unlock badge: ${error.message}`);
  }
};

/**
 * Add learning goal for student
 */
export const addGoal = async (userId, goal) => {
  try {
    const profile = await StudentProfile.findOne({ userId });
    if (!profile) throw new Error('Student profile not found');

    profile.goals.push({
      ...goal,
      createdAt: new Date()
    });
    await profile.save();
    return profile;
  } catch (error) {
    throw new Error(`Failed to add goal: ${error.message}`);
  }
};

/**
 * Get public leaderboard (students only)
 */
export const getLeaderboard = async (limit = 10, sortBy = 'totalXP') => {
  try {
    const leaderboard = await StudentProfile.find({ isPublic: true })
      .sort({ [sortBy]: -1 })
      .limit(limit)
      .select('name username avatar totalXP averageAccuracy topicsMastered currentStreak school major');

    return leaderboard;
  } catch (error) {
    throw new Error(`Failed to get leaderboard: ${error.message}`);
  }
};
