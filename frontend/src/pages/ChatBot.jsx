import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Plus, Trash2, Zap, Upload, Lightbulb, AlertCircle, BookOpen } from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { SuggestedQuestions } from '../components/SuggestedQuestions';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';

export const ChatBot = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMaterialId = searchParams.get('materialId');
  const messagesEndRef = useRef(null);
  const token = useAuthStore((state) => state.token);

  // State
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [hasContent, setHasContent] = useState(true);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState(initialMaterialId || '');
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadText, setUploadText] = useState('');
  const [uploadMode, setUploadMode] = useState('file');
  const [uploading, setUploading] = useState(false);

  const handleUploadMaterial = async (e) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      alert('Please enter a title for the study material');
      return;
    }

    setUploading(true);
    try {
      let uploadedDoc = null;
      if (uploadMode === 'file') {
        if (!uploadFile) {
          alert('Please select a file to upload');
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append('title', uploadTitle.trim());
        formData.append('file', uploadFile);
        const res = await client.post('/content/upload-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedDoc = res.data.data;
      } else {
        if (!uploadText.trim()) {
          alert('Please enter some text or notes to upload');
          setUploading(false);
          return;
        }
        const res = await client.post('/content/upload', {
          title: uploadTitle.trim(),
          text: uploadText.trim(),
          type: 'text'
        });
        uploadedDoc = res.data.data;
      }

      setHasContent(true);
      setShowUploadModal(false);
      const title = uploadTitle.trim();
      setUploadTitle('');
      setUploadFile(null);
      setUploadText('');

      if (uploadedDoc) {
        setAvailableMaterials(prev => [uploadedDoc, ...prev]);
        setSelectedMaterialId(uploadedDoc._id);
      }

      const uploadedNotice = {
        role: 'assistant',
        content: `📁 **"${title}"** has been uploaded and selected as your active study material! Ask me anything about its concepts, formulas, or key definitions.`
      };
      setMessages(prev => [...prev, uploadedNotice]);
    } catch (err) {
      console.error('Failed to upload material in chat:', err);
      alert('Upload failed: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if user has content and load materials
  useEffect(() => {
    const checkContent = async () => {
      try {
        const res = await client.get('/content');
        const list = res.data.data || [];
        setAvailableMaterials(list);
        setHasContent(list.length > 0);

        if (initialMaterialId) {
          const target = list.find(m => m._id === initialMaterialId);
          if (target) {
            setSelectedMaterialId(initialMaterialId);
            setMessages(prev => {
              if (prev.length === 0) {
                return [{
                  role: 'assistant',
                  content: `👋 Ready to study **"${target.title}"** (${target.type.toUpperCase()})!\n\nI am directly connected to this document. Ask me any questions, or request key definitions, summaries, or test preparation.`
                }];
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Error checking content:', error);
        setHasContent(false);
      }
    };
    checkContent();
  }, [initialMaterialId]);

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await client.get('/chatbot/sessions?limit=10');
        setSessions(res.data.data.sessions || []);
      } catch (error) {
        console.error('Error loading sessions:', error);
      }
    };
    loadSessions();
  }, []);

  // Send message
  const handleSendMessage = async (message) => {
    if (!message.trim() || loading) return;

    // Check if user is authenticated
    if (!token) {
      console.error('❌ No token found, user not authenticated');
      const errorMessage = {
        role: 'assistant',
        content: 'Please log in to use the chatbot'
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // Add user message
    const userMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setSuggestedQuestions([]);

    try {
      console.log('📨 Sending message:', message, 'materialId:', selectedMaterialId);
      const res = await client.post('/chatbot/message', {
        message,
        sessionId,
        contentId: selectedMaterialId || null
      });

      console.log('✅ Got response:', res.data.data);
      const { response, suggestedQuestions: suggestions, sources, topics } = res.data.data;

      // Add AI response
      const aiMessage = {
        role: 'assistant',
        content: response,
        sources,
        suggestedQuestions: suggestions,
        topics
      };
      setMessages(prev => [...prev, aiMessage]);
      setSuggestedQuestions(suggestions);

      // Update session ID
      if (!sessionId) {
        setSessionId(res.data.data.sessionId);
      }

      // Reload sessions
      const sessionsRes = await client.get('/chatbot/sessions?limit=10');
      setSessions(sessionsRes.data.data.sessions || []);
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = {
        role: 'assistant',
        content: error.response?.data?.error?.message || 'Failed to get response. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Start new chat
  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setSuggestedQuestions([]);
  };

  // Load session
  const handleLoadSession = async (id) => {
    try {
      const res = await client.get(`/chatbot/history/${id}`);
      const chatData = res.data.data;
      
      // Convert to message format
      const formattedMessages = chatData.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
        suggestedQuestions: msg.suggestedQuestions,
        topics: msg.topics
      }));

      setMessages(formattedMessages);
      setSessionId(id);
      setSuggestedQuestions([]);
      setShowSessions(false);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  // Delete session
  const handleDeleteSession = async (id, e) => {
    e.stopPropagation();
    try {
      await client.delete(`/chatbot/sessions/${id}`);
      setSessions(sessions.filter(s => s._id !== id));
      if (sessionId === id) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  // Generate quiz
  const handleGenerateQuiz = async () => {
    if (messages.length === 0) return;

    // Extract topics from messages
    const topics = new Set();
    messages.forEach(msg => {
      if (msg.topics) {
        msg.topics.forEach(t => topics.add(t));
      }
    });

    if (topics.size === 0) {
      alert('No topics found in conversation');
      return;
    }

    try {
      setLoading(true);
      const res = await client.post('/chatbot/generate-quiz', {
        topics: Array.from(topics),
        sessionId
      });

      // Store quiz and navigate
      localStorage.setItem('currentQuiz', JSON.stringify({
        ...res.data.data,
        _id: 'chat-quiz-' + Date.now()
      }));

      navigate('/quiz', { state: { quiz: res.data.data } });
    } catch (error) {
      console.error('Error generating quiz:', error);
      alert('Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <motion.div
        className={`fixed md:relative w-64 bg-white border-r border-border flex flex-col h-screen z-40 transition-transform ${
          showSessions ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        initial={{ x: -256 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <Button onClick={handleNewChat} className="w-full flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase px-2 mb-3">Recent Chats</p>
          {sessions.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">No chat history yet</p>
          ) : (
            sessions.map(session => (
              <motion.div
                key={session._id}
                onClick={() => handleLoadSession(session._id)}
                whileHover={{ x: 4 }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all group cursor-pointer ${
                  sessionId === session._id
                    ? 'bg-primary bg-opacity-10 border border-primary'
                    : 'hover:bg-bg-primary border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {session.sessionTitle}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {session.totalMessages} messages
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(session._id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-danger hover:text-danger hover:opacity-75" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="secondary"
            onClick={() => setShowUploadModal(true)}
            className="w-full text-sm flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Materials
          </Button>
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <motion.div
          className="bg-white border-b border-border p-6 flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Study Buddy</h1>
              <p className="text-sm text-text-secondary">AI-powered learning assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {availableMaterials.length > 0 && (
              <div className="flex items-center gap-1.5 bg-bg-secondary px-2.5 py-1.5 rounded-lg border border-border">
                <BookOpen className="w-3.5 h-3.5 text-primary hidden sm:inline" />
                <span className="text-xs font-semibold text-text-secondary hidden sm:inline">Material:</span>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedMaterialId(newId);
                    if (newId) {
                      const mat = availableMaterials.find(m => m._id === newId);
                      if (mat) {
                        setMessages(prev => [
                          ...prev,
                          {
                            role: 'assistant',
                            content: `🎯 Now focusing on **"${mat.title}"** (${mat.type.toUpperCase()}). Ask me questions or request explanations directly from this material!`
                          }
                        ]);
                      }
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-text-primary focus:outline-none cursor-pointer max-w-[150px] sm:max-w-[210px] truncate"
                >
                  <option value="">📚 All Uploaded Materials</option>
                  {availableMaterials.map((mat) => (
                    <option key={mat._id} value={mat._id}>
                      📄 {mat.title} ({mat.type.toUpperCase()})
                    </option>
                  ))}
                </select>
                {selectedMaterialId && (
                  <button
                    onClick={() => setSelectedMaterialId('')}
                    className="text-text-secondary hover:text-danger text-xs font-bold px-1"
                    title="Clear focus (search across all materials)"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <Button
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              className="text-xs md:text-sm py-1.5 px-3 flex items-center gap-1.5"
            >
              ← Dashboard
            </Button>
            {messages.length > 0 && (
              <Button
                onClick={handleGenerateQuiz}
                disabled={loading}
                className="flex items-center gap-2 text-xs md:text-sm py-1.5 px-3"
              >
                <Zap className="w-4 h-4" />
                Generate Quiz
              </Button>
            )}
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ☰
            </button>
          </div>
        </motion.div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-bg-primary">
          {messages.length === 0 ? (
            <motion.div
              className="h-full flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Card className="text-center max-w-md bg-bg-primary border-2 border-border">
                <div className="mb-4">
                  <MessageCircle className="w-16 h-16 text-primary mx-auto" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">Welcome to Study Buddy</h2>
                <p className="text-text-secondary mb-6">
                  Ask me anything about your uploaded study materials. I'll provide answers based on your content and suggest follow-up questions.
                </p>
                <div className="space-y-2 text-left mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-primary" />
                    <p className="text-sm font-semibold text-text-primary">Try asking:</p>
                  </div>
                  <ul className="text-sm text-text-secondary space-y-1">
                    <li>• "Explain photosynthesis"</li>
                    <li>• "What are the key concepts?"</li>
                    <li>• "How does this relate to...?"</li>
                  </ul>
                </div>
                <Button
                  onClick={() => setShowUploadModal(true)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Material to Chat
                </Button>
              </Card>
            </motion.div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  message={msg.content}
                  isUser={msg.role === 'user'}
                  sources={msg.sources}
                  suggestedQuestions={msg.suggestedQuestions}
                  onSuggestedClick={handleSendMessage}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Suggested Questions */}
        {suggestedQuestions.length > 0 && messages.length > 0 && (
          <div className="px-6">
            <SuggestedQuestions
              questions={suggestedQuestions}
              onQuestionClick={handleSendMessage}
              loading={loading}
            />
          </div>
        )}

        {/* Input Area */}
        {hasContent ? (
          <ChatInput
            onSendMessage={handleSendMessage}
            onOpenUpload={() => setShowUploadModal(true)}
            loading={loading}
            disabled={false}
          />
        ) : (
          <motion.div
            className="border-t border-gray-200 bg-white p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card className="bg-bg-primary border-2 border-danger text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-danger" />
                <p className="text-danger font-semibold">No Study Materials Found</p>
              </div>
              <p className="text-danger text-sm mb-4">
                Upload some study materials first to start chatting with the AI.
              </p>
              <Button onClick={() => setShowUploadModal(true)} className="w-full">
                Upload Materials
              </Button>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Upload Material Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload Study Material to Chat
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadMaterial} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Material Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Database Management Systems - Chapter 1"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-border rounded-lg focus:border-primary focus:outline-none text-sm"
                />
              </div>

              <div className="flex border-b border-border text-sm">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`pb-2 px-4 font-semibold ${
                    uploadMode === 'file'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-secondary'
                  }`}
                >
                  Upload File (PDF, DOCX, TXT, Image)
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('text')}
                  className={`pb-2 px-4 font-semibold ${
                    uploadMode === 'text'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-text-secondary'
                  }`}
                >
                  Paste Notes / Text
                </button>
              </div>

              {uploadMode === 'file' ? (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Choose File (PDF, Word, TXT, Image)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.mp4"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border-2 border-dashed border-border rounded-lg text-sm"
                  />
                  {uploadFile && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Study Notes / Content
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Paste your study material, lecture transcript, or notes here..."
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-border rounded-lg focus:border-primary focus:outline-none text-sm resize-none"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? 'Processing & Uploading...' : 'Upload & Start Chat'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
