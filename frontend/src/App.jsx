import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { SearchBar } from './components/SearchBar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Content } from './pages/Content';
import { Quiz } from './pages/Quiz';
import { Analytics } from './pages/Analytics';
import { ChatBot } from './pages/ChatBot';
import { LearningPath } from './pages/LearningPath';
import { Compare } from './pages/Compare';
import { Flashcards } from './pages/Flashcards';
import { Pomodoro } from './pages/Pomodoro';
import { Profile } from './pages/Profile';
import { TeacherLectures } from './pages/TeacherLectures';
import { 
  BookOpen, BarChart3, Layers, Clock, Map, TrendingUp, Users, MessageCircle, User, LogOut, Home as HomeIcon,
  Presentation
} from 'lucide-react';
import client from './api/client';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const Layout = ({ children }) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const isTeacher = user?.role === 'teacher';

  const navItems = isTeacher
    ? [
        { icon: BarChart3, label: 'Teacher Dashboard', path: '/dashboard' },
        { icon: Presentation, label: 'Lecture Studio', path: '/teacher/lectures' },
        { icon: Layers, label: 'Teaching Materials', path: '/content' },
        { icon: MessageCircle, label: 'Chat with AI', path: '/chatbot' },
        { icon: User, label: 'My Profile', path: `/profile/${user?.username}` }
      ]
    : [
        { icon: BarChart3, label: 'Dashboard', path: '/dashboard' },
        { icon: Layers, label: 'Study Materials', path: '/content' },
        { icon: Layers, label: 'Flashcards', path: '/flashcards' },
        { icon: Clock, label: 'Pomodoro', path: '/pomodoro' },
        { icon: Map, label: 'Learning Path', path: '/learning-path' },
        { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
        { icon: Users, label: 'Compare', path: '/compare' },
        { icon: MessageCircle, label: 'Chat with AI', path: '/chatbot' },
        { icon: User, label: 'My Profile', path: `/profile/${user?.username}` }
      ];

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-border flex flex-col fixed h-screen">
        {/* Logo Section */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">EduHub</h1>
              <p className="text-xs text-text-secondary">Learn Better</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-bg-primary transition-colors duration-150 font-medium text-text-secondary hover:text-text-primary flex items-center gap-3"
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User Section - Fixed at bottom */}
        <div className="border-t border-border p-4 space-y-3">
          <div className="bg-bg-primary rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Logged in as</p>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                isTeacher ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {user?.role || 'student'}
              </span>
            </div>
            <p className="font-semibold text-text-primary truncate">{user?.name}</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full px-4 py-2 bg-danger text-black rounded-lg hover:bg-opacity-90 transition-all duration-150 font-medium flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        {/* Top Navigation */}
        <nav className="bg-white border-b border-border sticky top-0 z-40">
          <div className="px-8 py-4 flex justify-between items-center gap-6">
            <h2 className="text-2xl font-bold text-text-primary whitespace-nowrap">
              Welcome to EduHub
            </h2>
            <div className="flex-1 max-w-md">
              <SearchBar />
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-text-primary font-medium">{user?.name}</span>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  const setUser = useAuthStore((state) => state.setUser);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      client.get('/auth/profile')
        .then((res) => setUser(res.data.data))
        .catch(() => {});
    }
  }, [token, setUser]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/content"
          element={
            <ProtectedRoute>
              <Layout>
                <Content />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/lectures"
          element={
            <ProtectedRoute>
              <Layout>
                <TeacherLectures />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Layout>
                <Analytics />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/learning-path"
          element={
            <ProtectedRoute>
              <Layout>
                <LearningPath />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/compare"
          element={
            <ProtectedRoute>
              <Layout>
                <Compare />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/flashcards"
          element={
            <ProtectedRoute>
              <Layout>
                <Flashcards />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pomodoro"
          element={
            <ProtectedRoute>
              <Layout>
                <Pomodoro />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <Layout>
                <Quiz />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chatbot"
          element={
            <ProtectedRoute>
              <ChatBot />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:username"
          element={
            <ProtectedRoute>
              <Layout>
                <Profile />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
