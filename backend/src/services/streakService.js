import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';

export class StreakService {
  /**
   * Updates and returns user's study streak.
   * Call when student completes a study session, quiz, or review.
   * @param {string} userId
   * @returns {Promise<number>} new streak count
   */
  async recordStudyActivity(userId) {
    if (!userId) return 0;

    const user = await User.findById(userId);
    if (!user) return 0;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let currentStreak = user.streak || 0;

    let streakChanged = false;
    let changeReason = '';

    if (!user.lastStudyDate) {
      // First activity
      currentStreak = 1;
      streakChanged = true;
      changeReason = 'started';
    } else {
      const lastStr = new Date(user.lastStudyDate).toISOString().split('T')[0];

      if (todayStr === lastStr) {
        // Already recorded study activity today; keep streak active (at least 1)
        if (currentStreak < 1) {
          currentStreak = 1;
          streakChanged = true;
          changeReason = 'activated';
        }
      } else {
        // Check difference in days
        const todayDate = new Date(todayStr);
        const lastDate = new Date(lastStr);
        const diffTime = Math.abs(todayDate - lastDate);
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Consecutive day! Increment streak
          currentStreak += 1;
          streakChanged = true;
          changeReason = 'incremented';
        } else {
          // Missed a day; reset to 1
          currentStreak = 1;
          streakChanged = true;
          changeReason = 'reset';
        }
      }
    }

    user.streak = currentStreak;
    user.lastStudyDate = now;
    await user.save();

    // Sync with StudentProfile
    const profile = await StudentProfile.findOne({ userId });
    if (profile) {
      profile.currentStreak = currentStreak;
      profile.longestStreak = Math.max(profile.longestStreak || 0, currentStreak);
      profile.lastActiveAt = now;
      await profile.save();
    }

    if (streakChanged) {
      console.log(`🔥 Streak ${changeReason} for user ${user.name || userId}: ${currentStreak} day(s)`);
    }
    return currentStreak;
  }
}

export default new StreakService();
