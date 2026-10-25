import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import {
  User,
  BarChart3,
  Trophy,
  Users,
  Edit3,
  Save,
  X,
  BookOpen,
  GraduationCap,
  Building,
  Briefcase,
  MapPin,
  Clock,
  Globe,
  Award,
  Flame,
  Target,
  Sparkles,
  CheckCircle,
  ExternalLink,
  Presentation,
  Layers,
  BookMarked
} from 'lucide-react';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

export const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const setCurrentUser = useAuthStore((state) => state.setUser);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = username ? `/profile/${username}` : '/profile';
      const res = await client.get(endpoint);
      const data = res.data.data;
      setProfile(data);
      setEditData({
        name: data.name || '',
        bio: data.bio || '',
        avatar: data.avatar || '',
        // Student fields
        school: data.school || '',
        grade: data.grade || '',
        major: data.major || '',
        learningStyle: data.learningStyle || 'Mixed',
        // Teacher fields
        institution: data.institution || '',
        department: data.department || '',
        designation: data.designation || 'Instructor',
        expertise: Array.isArray(data.expertise) ? data.expertise.join(', ') : (data.expertise || ''),
        officeLocation: data.officeLocation || '',
        officeHours: data.officeHours || '',
        website: data.website || '',
        // Social links
        socialLinks: {
          linkedin: data.socialLinks?.linkedin || '',
          github: data.socialLinks?.github || '',
          twitter: data.socialLinks?.twitter || '',
          scholar: data.socialLinks?.scholar || ''
        }
      });

      if (data.followers && currentUser?.id) {
        setIsFollowing(data.followers.some((f) => (f._id || f.id || f) === currentUser.id));
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!profile?.userId) return;
    try {
      if (isFollowing) {
        await client.post(`/profile/unfollow/${profile.userId}`);
        setIsFollowing(false);
      } else {
        await client.post(`/profile/follow/${profile.userId}`);
        setIsFollowing(true);
      }
      fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update follow status');
    }
  };

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    try {
      const payload = {
        name: editData.name,
        bio: editData.bio,
        avatar: editData.avatar,
        socialLinks: editData.socialLinks
      };

      if (isTeacher) {
        payload.institution = editData.institution;
        payload.department = editData.department;
        payload.designation = editData.designation;
        payload.expertise = editData.expertise;
        payload.officeLocation = editData.officeLocation;
        payload.officeHours = editData.officeHours;
        payload.website = editData.website;
      } else {
        payload.school = editData.school;
        payload.grade = editData.grade;
        payload.major = editData.major;
        payload.learningStyle = editData.learningStyle;
      }

      const res = await client.put('/profile', payload);
      const updated = res.data.data;
      setProfile(updated);
      setEditMode(false);

      // If user updated their name, sync in auth store as well
      if (currentUser && payload.name && payload.name !== currentUser.name) {
        setCurrentUser({ ...currentUser, name: payload.name });
      }

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-text-secondary text-sm">Loading profile details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-danger bg-opacity-10 border-2 border-danger text-center py-10 max-w-xl mx-auto">
        <p className="text-danger font-semibold text-lg mb-2">Error Loading Profile</p>
        <p className="text-text-secondary text-sm mb-4">{error}</p>
        <Button onClick={fetchProfile} variant="secondary">
          Try Again
        </Button>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="text-center py-12 max-w-xl mx-auto">
        <p className="text-text-secondary mb-4">Profile not found.</p>
        <Button onClick={() => navigate('/dashboard')} variant="primary">
          Back to Dashboard
        </Button>
      </Card>
    );
  }

  const isTeacher = (profile.role || currentUser?.role) === 'teacher';
  const isOwnProfile = !username || currentUser?.username === username || currentUser?.id === profile.userId;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {successMessage && (
        <div className="bg-success bg-opacity-15 border border-success text-success px-4 py-3 rounded-lg flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="font-medium text-sm">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-success hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Hero Header Card */}
      <Card className="border border-border bg-gradient-to-r from-bg-secondary via-white to-bg-secondary shadow-md overflow-hidden relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            {/* Avatar */}
            <div className="relative">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                />
              ) : (
                <div className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl shadow-md border-4 border-white ${
                  isTeacher ? 'bg-amber-500 text-white' : 'bg-primary text-white'
                }`}>
                  {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-success border-2 border-white rounded-full" title="Active" />
            </div>

            {/* User Meta */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-3xl font-extrabold text-text-primary">{profile.name}</h1>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  isTeacher
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                }`}>
                  {isTeacher ? <GraduationCap className="w-3.5 h-3.5" /> : <BookOpen className="w-3.5 h-3.5" />}
                  {isTeacher ? (profile.designation || 'Educator') : 'Student'}
                </span>
              </div>

              <p className="text-text-secondary text-sm font-medium">@{profile.username || 'user'}</p>

              {profile.bio && (
                <p className="text-text-primary text-sm max-w-xl mt-2 leading-relaxed italic">
                  "{profile.bio}"
                </p>
              )}

              {/* Sub-meta details */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-text-secondary pt-1">
                {isTeacher ? (
                  <>
                    {profile.institution && (
                      <span className="flex items-center gap-1 font-medium">
                        <Building className="w-3.5 h-3.5 text-primary" />
                        {profile.institution}
                      </span>
                    )}
                    {profile.department && (
                      <span className="flex items-center gap-1 font-medium">
                        <Briefcase className="w-3.5 h-3.5 text-accent" />
                        {profile.department}
                      </span>
                    )}
                    {profile.officeLocation && (
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-danger" />
                        {profile.officeLocation}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {profile.school && (
                      <span className="flex items-center gap-1 font-medium">
                        <Building className="w-3.5 h-3.5 text-primary" />
                        {profile.school}
                      </span>
                    )}
                    {profile.major && (
                      <span className="flex items-center gap-1 font-medium">
                        <BookMarked className="w-3.5 h-3.5 text-accent" />
                        {profile.major}
                      </span>
                    )}
                    {profile.grade && (
                      <span className="flex items-center gap-1 font-medium">
                        <GraduationCap className="w-3.5 h-3.5 text-success" />
                        {profile.grade}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Followers / Following counts */}
              <div className="flex items-center justify-center sm:justify-start gap-5 pt-2 text-xs">
                <div>
                  <span className="font-bold text-text-primary text-sm">{profile.followers?.length || 0}</span>{' '}
                  <span className="text-text-secondary">Followers</span>
                </div>
                <div className="w-1 h-1 bg-border rounded-full" />
                <div>
                  <span className="font-bold text-text-primary text-sm">{profile.following?.length || 0}</span>{' '}
                  <span className="text-text-secondary">Following</span>
                </div>
                <div className="w-1 h-1 bg-border rounded-full" />
                <div>
                  <span className="text-text-secondary">Joined {new Date(profile.joinedAt || profile.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
            {!isOwnProfile && (
              <Button
                onClick={handleFollow}
                variant={isFollowing ? 'secondary' : 'primary'}
                className="px-6"
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            )}

            {isOwnProfile && (
              <Button
                onClick={() => setEditMode(!editMode)}
                variant={editMode ? 'secondary' : 'primary'}
                className="px-5 shadow-sm"
              >
                {editMode ? (
                  <>
                    <X className="w-4 h-4 mr-1.5 inline" />
                    Close Editor
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4 mr-1.5 inline" />
                    Edit Profile
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Edit Mode Form (Expandable) */}
      {editMode && isOwnProfile && (
        <Card className="border-2 border-primary bg-bg-primary shadow-lg animate-fade-in">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary bg-opacity-10 flex items-center justify-center text-primary">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">
                  {isTeacher ? 'Edit Educator Profile' : 'Edit Student Profile'}
                </h2>
                <p className="text-xs text-text-secondary">
                  Update your personal, academic, and contact information
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditMode(false)}
              className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* General Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                1. Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Full Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                    placeholder="e.g. Dr. John Doe or Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Avatar Image URL
                  </label>
                  <input
                    type="url"
                    value={editData.avatar}
                    onChange={(e) => setEditData({ ...editData, avatar: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Bio / About Me
                </label>
                <textarea
                  value={editData.bio}
                  onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                  rows="3"
                  placeholder={
                    isTeacher
                      ? 'Share your research interests, teaching background, and subjects you instruct...'
                      : 'Share your academic goals, interests, and what you are currently studying...'
                  }
                />
              </div>
            </div>

            {/* Role Specific Section */}
            {isTeacher ? (
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  2. Educator & Department Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Designation / Title
                    </label>
                    <select
                      value={editData.designation}
                      onChange={(e) => setEditData({ ...editData, designation: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                    >
                      <option>Professor</option>
                      <option>Associate Professor</option>
                      <option>Assistant Professor</option>
                      <option>Lecturer</option>
                      <option>Teaching Assistant</option>
                      <option>Instructor</option>
                      <option>Department Head</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Department / Faculty
                    </label>
                    <input
                      type="text"
                      value={editData.department}
                      onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. Computer Science & Engineering"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Institution / University
                    </label>
                    <input
                      type="text"
                      value={editData.institution}
                      onChange={(e) => setEditData({ ...editData, institution: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. Manipal University Jaipur"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Areas of Expertise <span className="text-text-secondary font-normal">(comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={editData.expertise}
                      onChange={(e) => setEditData({ ...editData, expertise: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. Software Testing, Algorithms, DBMS, Machine Learning"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Personal / Lab Website
                    </label>
                    <input
                      type="url"
                      value={editData.website}
                      onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="https://mylab.edu/~professor"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Office / Room Location
                    </label>
                    <input
                      type="text"
                      value={editData.officeLocation}
                      onChange={(e) => setEditData({ ...editData, officeLocation: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. Room 304, Academic Block 2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Office / Consultation Hours
                    </label>
                    <input
                      type="text"
                      value={editData.officeHours}
                      onChange={(e) => setEditData({ ...editData, officeHours: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. Mon & Wed 2:00 PM - 4:00 PM"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  2. Academic & Learning Preferences
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      School / University
                    </label>
                    <input
                      type="text"
                      value={editData.school}
                      onChange={(e) => setEditData({ ...editData, school: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. Manipal University Jaipur"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Major / Department
                    </label>
                    <input
                      type="text"
                      value={editData.major}
                      onChange={(e) => setEditData({ ...editData, major: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. Computer Science, Mechanical, Biology"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Academic Year / Semester
                    </label>
                    <input
                      type="text"
                      value={editData.grade}
                      onChange={(e) => setEditData({ ...editData, grade: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                      placeholder="e.g. 4th Year / Semester 7"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Preferred Learning Style
                    </label>
                    <select
                      value={editData.learningStyle}
                      onChange={(e) => setEditData({ ...editData, learningStyle: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                    >
                      <option>Visual</option>
                      <option>Auditory</option>
                      <option>Kinesthetic</option>
                      <option>Reading</option>
                      <option>Mixed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Social & Professional Links */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                3. Social & Professional Links
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={editData.socialLinks.linkedin}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        socialLinks: { ...editData.socialLinks, linkedin: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">GitHub Profile</label>
                  <input
                    type="url"
                    value={editData.socialLinks.github}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        socialLinks: { ...editData.socialLinks, github: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                    placeholder="https://github.com/username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    {isTeacher ? 'Google Scholar / Twitter' : 'Twitter / X Profile'}
                  </label>
                  <input
                    type="url"
                    value={isTeacher ? (editData.socialLinks.scholar || editData.socialLinks.twitter) : editData.socialLinks.twitter}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        socialLinks: isTeacher
                          ? { ...editData.socialLinks, scholar: e.target.value }
                          : { ...editData.socialLinks, twitter: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-primary text-sm"
                    placeholder={isTeacher ? 'https://scholar.google.com/citations?user=...' : 'https://x.com/username'}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="secondary" onClick={() => setEditMode(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                <Save className="w-4 h-4 mr-1.5 inline" />
                Save Profile
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Main Stats Grid */}
      {isTeacher ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <Presentation className="w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-amber-600">{profile.totalLecturesUploaded || 0}</p>
            <p className="text-xs font-medium text-text-secondary mt-1">Lectures Created</p>
          </Card>

          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-primary flex items-center justify-center mx-auto mb-2">
              <Layers className="w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-primary">{profile.totalMaterialsUploaded || 0}</p>
            <p className="text-xs font-medium text-text-secondary mt-1">Teaching Materials</p>
          </Card>

          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-purple-600">{profile.followers?.length || 0}</p>
            <p className="text-xs font-medium text-text-secondary mt-1">Enrolled Students</p>
          </Card>

          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-success flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-2xl font-extrabold text-success truncate">
              {Array.isArray(profile.expertise) && profile.expertise.length > 0
                ? `${profile.expertise.length} Topics`
                : 'Active'}
            </p>
            <p className="text-xs font-medium text-text-secondary mt-1">Expertise Areas</p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-primary flex items-center justify-center mx-auto mb-2">
              <Trophy className="w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-primary">{profile.totalXP || 0}</p>
            <p className="text-xs font-medium text-text-secondary mt-1">Total XP</p>
          </Card>

          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-success flex items-center justify-center mx-auto mb-2">
              <Target className="w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-success">{Math.round(profile.averageAccuracy || 0)}%</p>
            <p className="text-xs font-medium text-text-secondary mt-1">Accuracy</p>
          </Card>

          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-warning flex items-center justify-center mx-auto mb-2">
              <Flame className="w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-warning">{profile.currentStreak || 0}</p>
            <p className="text-xs font-medium text-text-secondary mt-1">Day Streak</p>
          </Card>

          <Card className="text-center p-5 border border-border hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2">
              <Award className="w-5 h-5" />
            </div>
            <p className="text-3xl font-extrabold text-purple-600">{profile.totalQuizzesTaken || 0}</p>
            <p className="text-xs font-medium text-text-secondary mt-1">Quizzes Completed</p>
          </Card>
        </div>
      )}

      {/* Role-Specific Detail Cards */}
      {isTeacher ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Educator Details */}
          <Card className="border border-border space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <GraduationCap className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold text-text-primary">Faculty Information</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Institution:</span>
                <span className="font-semibold text-text-primary">{profile.institution || 'Not configured'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Department:</span>
                <span className="font-semibold text-text-primary">{profile.department || 'Not configured'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Designation:</span>
                <span className="font-semibold text-text-primary">{profile.designation || 'Instructor'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Office:</span>
                <span className="font-semibold text-text-primary">{profile.officeLocation || 'Not configured'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-secondary">Office Hours:</span>
                <span className="font-semibold text-text-primary">{profile.officeHours || 'By appointment'}</span>
              </div>
            </div>
          </Card>

          {/* Areas of Expertise */}
          <Card className="border border-border space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-text-primary">Areas of Expertise</h2>
            </div>
            {Array.isArray(profile.expertise) && profile.expertise.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {profile.expertise.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-bg-secondary text-text-primary rounded-lg text-xs font-semibold border border-border"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-secondary italic py-4">
                No expertise areas added yet. Click "Edit Profile" to list your subject specialties.
              </p>
            )}

            {/* Links */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-xs font-bold text-text-secondary uppercase mb-2">Web & Publications</h3>
              <div className="flex flex-wrap gap-3">
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                  >
                    <Globe className="w-3.5 h-3.5" /> Website
                  </a>
                )}
                {profile.socialLinks?.scholar && (
                  <a
                    href={profile.socialLinks.scholar}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Google Scholar
                  </a>
                )}
                {profile.socialLinks?.linkedin && (
                  <a
                    href={profile.socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
                {profile.socialLinks?.github && (
                  <a
                    href={profile.socialLinks.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> GitHub
                  </a>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Academic Info */}
          <Card className="border border-border space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <GraduationCap className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-text-primary">Academic Information</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Institution:</span>
                <span className="font-semibold text-text-primary">{profile.school || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Major:</span>
                <span className="font-semibold text-text-primary">{profile.major || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Year / Grade:</span>
                <span className="font-semibold text-text-primary">{profile.grade || 'Not specified'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-secondary">Learning Style:</span>
                <span className="font-semibold text-primary px-2 py-0.5 bg-primary bg-opacity-10 rounded border border-primary text-xs">
                  {profile.learningStyle || 'Mixed'}
                </span>
              </div>
            </div>
          </Card>

          {/* Study Metrics */}
          <Card className="border border-border space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <BarChart3 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-text-primary">Study Metrics</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Study Hours:</span>
                <span className="font-semibold text-text-primary">{profile.totalStudyHours || 0} hrs</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Topics Studied:</span>
                <span className="font-semibold text-text-primary">{profile.topicsStudied || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-text-secondary">Topics Mastered:</span>
                <span className="font-semibold text-success">{profile.topicsMastered || 0}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-secondary">Longest Streak:</span>
                <span className="font-semibold text-warning">{profile.longestStreak || profile.currentStreak || 0} days</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Badges / Achievements (For Students) */}
      {!isTeacher && profile.badges && profile.badges.length > 0 && (
        <Card className="border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-text-primary">Achievements & Badges</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {profile.badges.map((badge, idx) => (
              <div key={idx} className="bg-bg-secondary rounded-lg p-3 text-center border border-border">
                <span className="text-2xl mb-1 block">{badge.icon || '⭐'}</span>
                <p className="font-bold text-xs text-text-primary truncate">{badge.name}</p>
                <p className="text-[10px] text-text-secondary mt-0.5 line-clamp-2">{badge.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Followers & Following Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Followers */}
        <Card className="border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-text-primary">Followers ({profile.followers?.length || 0})</h3>
          </div>
          {profile.followers && profile.followers.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {profile.followers.map((f) => (
                <div key={f._id || f.id} className="flex items-center justify-between p-2 rounded-lg bg-bg-secondary text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                      {f.name ? f.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{f.name}</p>
                      <p className="text-[10px] text-text-secondary">@{f.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/profile/${f.username}`)}
                    className="text-primary hover:underline font-semibold"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary italic">No followers yet.</p>
          )}
        </Card>

        {/* Following */}
        <Card className="border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-text-primary">Following ({profile.following?.length || 0})</h3>
          </div>
          {profile.following && profile.following.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {profile.following.map((f) => (
                <div key={f._id || f.id} className="flex items-center justify-between p-2 rounded-lg bg-bg-secondary text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center font-bold">
                      {f.name ? f.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary">{f.name}</p>
                      <p className="text-[10px] text-text-secondary">@{f.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/profile/${f.username}`)}
                    className="text-primary hover:underline font-semibold"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary italic">Not following anyone yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
};
