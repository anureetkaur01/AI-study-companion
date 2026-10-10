import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

export const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await client.post('/auth/register', formData);
      setAuth(res.data.data.user, res.data.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-slate-200 opacity-10 rounded-full -ml-48 -mt-48"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-slate-200 opacity-10 rounded-full -mr-48 -mb-48"></div>

      <motion.div
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10 border border-gray-200"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Get Started
          </h1>
          <p className="text-gray-600">Create your account to begin learning</p>
        </div>

        {error && (
          <motion.div
            className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 flex items-start gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-xl">⚠️</span>
            <p className="text-sm">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="your@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="•••••••• (min 6 characters)"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">Account Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'student' })}
                className={`py-2.5 px-4 rounded-lg font-medium border-2 text-sm transition-all text-center ${
                  (formData.role || 'student') === 'student'
                    ? 'border-primary bg-primary bg-opacity-10 text-primary font-bold shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                🎓 Student
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'teacher' })}
                className={`py-2.5 px-4 rounded-lg font-medium border-2 text-sm transition-all text-center ${
                  formData.role === 'teacher'
                    ? 'border-primary bg-primary bg-opacity-10 text-primary font-bold shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                👨‍🏫 Teacher
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {formData.role === 'teacher' 
                ? 'Teachers can generate lecture materials, download PPTX slides & PDF notes.' 
                : 'Students can take quizzes, track mastery, and summarize notes.'}
            </p>
          </div>
          <Button type="submit" loading={loading} className="w-full">
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
