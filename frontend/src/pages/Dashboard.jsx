import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Zap, Flame, BookOpen, TrendingUp, Presentation, FileText, CheckCircle2, 
  Clock, ArrowRight, Sparkles, Download, Award, AlertCircle, MessageCircle 
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

export const Dashboard = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const isTeacher = user?.role === 'teacher';

  const [performance, setPerformance] = useState(null);
  const [contents, setContents] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingQuizId, setGeneratingQuizId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isTeacher) {
          const [lecturesRes, contentsRes] = await Promise.all([
            client.get('/teacher/lectures').catch(() => ({ data: { data: [] } })),
            client.get('/content').catch(() => ({ data: { data: [] } }))
          ]);
          setLectures(lecturesRes.data.data || []);
          setContents(contentsRes.data.data || []);
        } else {
          const [perfRes, contentsRes, quizRes] = await Promise.all([
            client.get('/analytics/performance').catch(() => ({ data: { data: null } })),
            client.get('/content').catch(() => ({ data: { data: [] } })),
            client.get('/quiz/history').catch(() => ({ data: { data: [] } }))
          ]);
          setPerformance(perfRes.data.data);
          setContents(contentsRes.data.data || []);
          setQuizHistory(quizRes.data.data || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isTeacher]);

  const handleDownload = async (lectureId, title, format) => {
    try {
      const endpoint = format === 'pptx' 
        ? `/teacher/lectures/${lectureId}/download-pptx`
        : `/teacher/lectures/${lectureId}/download-pdf`;

      const response = await client.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: format === 'pptx' 
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
          : 'application/pdf'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (title || 'lecture').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${safeTitle}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to download ${format.toUpperCase()}: ${err.message}`);
    }
  };

  const handleQuickQuiz = async (contentId, e) => {
    if (e) e.stopPropagation();
    setGeneratingQuizId(contentId);
    try {
      const res = await client.post('/quiz/generate', { 
        contentId,
        count: 5,
        difficulty: 'medium'
      });
      if (res.data.data && res.data.data._id) {
        localStorage.setItem('currentQuiz', JSON.stringify(res.data.data));
        navigate('/quiz', { state: { quiz: res.data.data } });
      }
    } catch (err) {
      alert('Failed to generate quiz: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setGeneratingQuizId(null);
    }
  };

  const handleDownloadAnki = async (item, e, format = 'anki') => {
    if (e) e.stopPropagation();
    try {
      const endpoint = format === 'structured'
        ? `/flashcards/export/anki?contentId=${item._id}&format=structured`
        : `/flashcards/export/anki?contentId=${item._id}`;
      
      const response = await client.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
      const safeTitle = (item.title || 'flashcards').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = format === 'structured' ? `${safeTitle}_structured_cards.txt` : `${safeTitle}_anki_deck.txt`;
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
    } catch (err) {
      alert('Failed to export flashcards: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium text-sm">Loading your personalized dashboard...</p>
      </div>
    );
  }

  // Calculate dynamic average quiz score if available
  const completedQuizzes = quizHistory.filter(q => q.completedAt);
  const avgQuizScore = completedQuizzes.length > 0
    ? Math.round(completedQuizzes.reduce((acc, q) => acc + (q.accuracy || 0), 0) / completedQuizzes.length)
    : Math.round(performance?.user?.averageAccuracy || 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-primary text-white rounded-2xl p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              {isTeacher ? <Presentation className="w-4 h-4" /> : <Award className="w-4 h-4" />}
              {isTeacher ? 'Teacher Academic Portal' : 'Student Study Companion (FR-14)'}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Scholar'}!
            </h1>
            <p className="text-blue-100 max-w-2xl text-sm leading-relaxed">
              {isTeacher
                ? 'Generate structured lectures, create slide decks, and distribute course handouts seamlessly.'
                : 'Track your quiz performance, review topic mastery, and practice questions from your study materials.'}
            </p>
          </div>
          <div>
            {isTeacher ? (
              <Button
                onClick={() => navigate('/teacher/lectures')}
                className="bg-white text-primary hover:bg-blue-50 font-bold px-5 py-3 shadow-md flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-primary" /> Create Lecture Deck
              </Button>
            ) : (
              <Button
                onClick={() => navigate('/content')}
                className="bg-white text-primary hover:bg-blue-50 font-bold px-5 py-3 shadow-md flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-primary" /> Study Materials
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {isTeacher ? (
          <>
            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Lectures Created</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">{lectures.length}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                  <Presentation className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Course Materials</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">{contents.length}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Slides Exportable</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">{lectures.length}</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                  <Presentation className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">PDF Handouts</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">{lectures.length}</p>
                </div>
                <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quizzes Attempted</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">
                    {completedQuizzes.length || performance?.user?.totalQuizzesTaken || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Score</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">{avgQuizScore}%</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl text-green-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Study Streak</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">
                    {performance?.user?.streak || 0} <span className="text-xs font-normal text-gray-400">days</span>
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-amber-500">
                  <Flame className="w-6 h-6" />
                </div>
              </div>
            </Card>

            <Card className="p-5 border-2 border-border hover:border-primary/40 transition-all bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">XP Earned</p>
                  <p className="text-3xl font-black text-gray-900 mt-1">
                    {performance?.user?.xp || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                  <Zap className="w-6 h-6" />
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Main Section Based on Role */}
      {isTeacher ? (
        /* Teacher Dashboard View */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Presentation className="w-5 h-5 text-primary" /> Generated Lecture Decks & Handouts
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate('/chatbot')}
                className="text-xs font-semibold"
              >
                <MessageCircle className="w-4 h-4 mr-1.5 inline text-primary" />
                Chat with AI
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate('/teacher/lectures')}
                className="text-xs font-semibold"
              >
                Open Lecture Studio →
              </Button>
            </div>
          </div>

          {lectures.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {lectures.map((lec) => (
                <Card key={lec._id} className="p-5 border-2 border-border hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {lec.topic}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(lec.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-gray-900 line-clamp-2 mb-2">{lec.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-3 mb-4">{lec.introduction || lec.summary}</p>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleDownload(lec._id, lec.title, 'pptx')}
                      className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded flex items-center justify-center gap-1 border border-amber-200"
                    >
                      <Presentation className="w-3.5 h-3.5" /> PPTX
                    </button>
                    <button
                      onClick={() => handleDownload(lec._id, lec.title, 'pdf')}
                      className="flex-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded flex items-center justify-center gap-1 border border-blue-200"
                    >
                      <FileText className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center bg-gray-50 border-2 border-dashed border-gray-300">
              <Presentation className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-base font-bold text-gray-800 mb-1">No Lecture Materials Created Yet</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                Use the Lecture Studio to transform your curriculum topics or course documents into complete PowerPoint decks and printable PDFs.
              </p>
              <Button onClick={() => navigate('/teacher/lectures')}>
                Launch Lecture Studio Now
              </Button>
            </Card>
          )}
        </div>
      ) : (
        /* Student Dashboard View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Recent Quiz Performance (FR-14) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" /> Recent Quiz Results
              </h2>
              <span className="text-xs text-gray-500 font-medium">
                {completedQuizzes.length} total attempts
              </span>
            </div>

            {completedQuizzes.length > 0 ? (
              <div className="space-y-3">
                {completedQuizzes.slice(0, 5).map((quiz) => {
                  const accuracy = Math.round(quiz.accuracy || 0);
                  const isHigh = accuracy >= 80;
                  const isMid = accuracy >= 60;
                  const badgeColor = isHigh 
                    ? 'bg-green-100 text-green-800 border-green-200' 
                    : isMid 
                    ? 'bg-amber-100 text-amber-800 border-amber-200' 
                    : 'bg-red-100 text-red-800 border-red-200';

                  return (
                    <Card key={quiz._id} className="p-4 border-2 border-border hover:border-gray-300 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="font-bold text-sm text-gray-900">
                            {quiz.contentId?.title || 'Practice Quiz'}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{new Date(quiz.completedAt || quiz.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="capitalize">{quiz.difficulty}</span>
                            <span>•</span>
                            <span>{quiz.questions?.length || 0} Questions</span>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {quiz.score} / {quiz.questions?.length || 0}
                            </p>
                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                              {accuracy}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300">
                <CheckCircle2 className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="font-bold text-gray-700 text-sm mb-1">No Quizzes Attempted Yet</p>
                <p className="text-xs text-gray-500 mb-4">
                  Generate quizzes from your uploaded materials to test your understanding and build knowledge mastery.
                </p>
                <Button onClick={() => navigate('/content')} className="text-xs">
                  Take a Practice Quiz
                </Button>
              </Card>
            )}
          </div>

          {/* Right Column: Previously Generated Materials & Summaries */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> Study Materials & Summaries
              </h2>
              <button
                onClick={() => navigate('/content')}
                className="text-xs text-primary hover:underline font-semibold"
              >
                View All →
              </button>
            </div>

            {contents.length > 0 ? (
              <div className="space-y-3">
                {contents.slice(0, 5).map((item) => (
                  <Card 
                    key={item._id} 
                    className="p-4 border-2 border-border hover:border-gray-300 transition-all cursor-pointer"
                    onClick={() => navigate('/content')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 max-w-[65%]">
                        <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{item.title}</h4>
                        <p className="text-xs text-gray-400 capitalize">
                          Format: {item.type.toUpperCase()} • {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/chatbot?materialId=${item._id}`);
                          }}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1 transition-colors"
                          title="Chat with AI about this study material"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Chat
                        </button>
                        <button
                          onClick={(e) => handleQuickQuiz(item._id, e)}
                          disabled={generatingQuizId !== null}
                          className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/20 flex items-center gap-1 transition-colors"
                          title="Generate Practice Quiz for this material"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          {generatingQuizId === item._id ? 'Generating...' : 'Quiz'}
                        </button>
                        <button
                          onClick={(e) => handleDownloadAnki(item, e, 'anki')}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 flex items-center gap-1 transition-colors"
                          title="Export Anki deck (.txt)"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Anki
                        </button>
                        <button
                          onClick={(e) => handleDownloadAnki(item, e, 'structured')}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 flex items-center gap-1 transition-colors"
                          title="Download structured study flashcards (.txt)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Notes
                        </button>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300">
                <BookOpen className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="font-bold text-gray-700 text-sm mb-1">No Study Materials</p>
                <p className="text-xs text-gray-500 mb-4">
                  Upload PDF notes, images, or lecture videos to get AI summaries and practice tests.
                </p>
                <Button onClick={() => navigate('/content')} className="text-xs">
                  Upload Materials
                </Button>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
