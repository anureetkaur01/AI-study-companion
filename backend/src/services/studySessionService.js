import StudySession from '../models/StudySession.js';
import Content from '../models/Content.js';
import StudentProfile from '../models/StudentProfile.js';
import streakService from './streakService.js';
import { AppError } from '../middleware/errorHandler.js';

export class StudySessionService {
  async startSession(userId, topic, duration, type = 'focus') {
    const session = new StudySession({
      userId,
      topic,
      duration,
      type,
      startTime: new Date(),
      completed: false
    });

    await session.save();
    return session;
  }

  async completeSession(userId, sessionId) {
    const session = await StudySession.findById(sessionId);
    if (!session || session.userId.toString() !== userId) {
      throw new AppError('Session not found', 404);
    }

    session.completed = true;
    session.endTime = new Date();
    await session.save();

    // Update student profile study hours
    const profile = await StudentProfile.findOne({ userId });
    if (profile) {
      const durationHours = session.duration / 60;
      profile.totalStudyHours = (profile.totalStudyHours || 0) + durationHours;
      profile.lastActiveAt = new Date();
      await profile.save();
    }

    // Update study streak on completing focus session
    if (session.type === 'focus') {
      await streakService.recordStudyActivity(userId);
    }

    return session;
  }

  async getTodayStats(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await StudySession.find({
      userId,
      createdAt: { $gte: today },
      type: 'focus',
      completed: true
    });

    const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
    const sessionsCompleted = sessions.length;

    // Group by topic
    const byTopic = {};
    sessions.forEach(session => {
      if (!byTopic[session.topic]) {
        byTopic[session.topic] = { minutes: 0, sessions: 0 };
      }
      byTopic[session.topic].minutes += session.duration;
      byTopic[session.topic].sessions += 1;
    });

    return {
      totalMinutes,
      sessionsCompleted,
      byTopic: Object.entries(byTopic).map(([topic, data]) => ({
        topic,
        minutes: data.minutes,
        sessions: data.sessions
      }))
    };
  }

  async getWeeklyStats(userId) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const sessions = await StudySession.find({
      userId,
      createdAt: { $gte: weekAgo },
      type: 'focus',
      completed: true
    });

    const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
    const sessionsCompleted = sessions.length;

    // Group by day
    const byDay = {};
    sessions.forEach(session => {
      const day = session.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = { minutes: 0, sessions: 0 };
      }
      byDay[day].minutes += session.duration;
      byDay[day].sessions += 1;
    });

    // Fill in missing days
    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      dailyData.push({
        date: dateStr,
        minutes: byDay[dateStr]?.minutes || 0,
        sessions: byDay[dateStr]?.sessions || 0
      });
    }

    // Group by topic
    const byTopic = {};
    sessions.forEach(session => {
      if (!byTopic[session.topic]) {
        byTopic[session.topic] = { minutes: 0, sessions: 0 };
      }
      byTopic[session.topic].minutes += session.duration;
      byTopic[session.topic].sessions += 1;
    });

    return {
      totalMinutes,
      sessionsCompleted,
      dailyData,
      byTopic: Object.entries(byTopic).map(([topic, data]) => ({
        topic,
        minutes: data.minutes,
        sessions: data.sessions
      })).sort((a, b) => b.minutes - a.minutes)
    };
  }

  async getAvailableTopics(userId) {
    const contents = await Content.find({ userId }).select('topics');
    const topicsSet = new Set();
    
    contents.forEach(content => {
      if (content.topics) {
        content.topics.forEach(topic => topicsSet.add(topic));
      }
    });

    return Array.from(topicsSet);
  }

  async getRecentSessions(userId, limit = 10) {
    const sessions = await StudySession.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return sessions;
  }
}

export default new StudySessionService();
