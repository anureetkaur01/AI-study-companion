import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as profileService from '../services/profileService.js';

const router = express.Router();

// Get current user's profile
router.get('/', authenticate, async (req, res) => {
  try {
    const profile = await profileService.getProfileByUserId(req.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get profile by username
router.get('/:username', async (req, res) => {
  try {
    const profile = await profileService.getProfileByUsername(req.params.username);
    
    if (!profile) {
      return res.status(404).json({ success: false, error: { message: 'Profile not found' } });
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create or initialize profile
router.post('/', authenticate, async (req, res) => {
  try {
    const profile = await profileService.updateProfile(req.userId, req.body);
    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update profile
router.put('/', authenticate, async (req, res) => {
  try {
    const profile = await profileService.updateProfile(req.userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Follow user
router.post('/follow/:userId', authenticate, async (req, res) => {
  try {
    const result = await profileService.followUser(req.userId, req.params.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Unfollow user
router.post('/unfollow/:userId', authenticate, async (req, res) => {
  try {
    const result = await profileService.unfollowUser(req.userId, req.params.userId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get leaderboard
router.get('/leaderboard/top', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const sortBy = req.query.sortBy || 'totalXP';
    const leaderboard = await profileService.getLeaderboard(limit, sortBy);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

export default router;
