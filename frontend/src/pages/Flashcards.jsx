import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import client from '../api/client';
import { Layers, Download, FileText, Play, Trash2, CheckCircle, XCircle, RefreshCw, Sparkles } from 'lucide-react';

export const Flashcards = () => {
  const [contents, setContents] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [mode, setMode] = useState('select'); // select, study, complete
  const [contentFlashcardCounts, setContentFlashcardCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  useEffect(() => {
    fetchContents();
    fetchStats();
    fetchAllFlashcards();
  }, []);

  const fetchContents = async () => {
    try {
      const res = await client.get('/content');
      setContents(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch contents:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await client.get('/flashcards/stats');
      setStats(res.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchAllFlashcards = async () => {
    try {
      const res = await client.get('/flashcards');
      const counts = {};
      res.data.data.forEach(card => {
        const contentId = card.contentId._id || card.contentId;
        counts[contentId] = (counts[contentId] || 0) + 1;
      });
      setContentFlashcardCounts(counts);
    } catch (error) {
      console.error('Failed to fetch flashcards:', error);
    }
  };

  const generateFlashcards = async (contentId) => {
    setLoading(true);
    try {
      // This will either generate new flashcards or return existing ones
      const res = await client.post('/flashcards/generate', { contentId, count: 15 });
      setFlashcards(res.data.data);
      setCurrentIndex(0);
      setMode('study');
      fetchStats();
      fetchAllFlashcards();
    } catch (error) {
      alert(error.response?.data?.error?.message || 'Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  };

  const deleteFlashcards = async (contentId) => {
    if (!window.confirm('Delete all flashcards for this content?')) {
      return;
    }
    
    setLoading(true);
    try {
      await client.delete(`/flashcards/content/${contentId}`);
      fetchStats();
      fetchAllFlashcards();
      alert('Flashcards deleted successfully');
    } catch (error) {
      alert('Failed to delete flashcards');
    } finally {
      setLoading(false);
    }
  };

  const loadFlashcards = async (contentId) => {
    setLoading(true);
    try {
      const res = await client.get(`/flashcards?contentId=${contentId}`);
      if (res.data.data.length === 0) {
        alert('No flashcards found. Generate them first!');
        return;
      }
      setFlashcards(res.data.data);
      setCurrentIndex(0);
      setMode('study');
    } catch (error) {
      alert('Failed to load flashcards');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (known) => {
    const currentCard = flashcards[currentIndex];
    
    try {
      await client.post(`/flashcards/${currentCard._id}/review`, { known });
      fetchStats();
    } catch (error) {
      console.error('Failed to review flashcard:', error);
    }

    // Reset flip state before moving to next card
    setIsFlipped(false);

    // Move to next card after a short delay to show the reset
    setTimeout(() => {
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        x.set(0);
      } else {
        setMode('complete');
      }
    }, 100);
  };

  const handleDragEnd = (event, info) => {
    if (Math.abs(info.offset.x) > 100) {
      const known = info.offset.x > 0;
      handleSwipe(known);
    } else {
      x.set(0);
    }
  };

  const handleExport = async (content = null, format = 'anki') => {
    try {
      const target = content || selectedContent;
      const contentId = target?._id;
      const endpoint = format === 'structured'
        ? (contentId ? `/flashcards/export/anki?contentId=${contentId}&format=structured` : '/flashcards/export/anki?format=structured')
        : (contentId ? `/flashcards/export/anki?contentId=${contentId}` : '/flashcards/export/anki');
      
      const response = await client.get(endpoint, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
      const safeTitle = (target?.title || 'study_flashcards').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = format === 'structured'
        ? `${safeTitle}_structured_cards.txt`
        : `${safeTitle}_anki_deck.txt`;
        
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);

      if (format === 'anki') {
        alert(`✅ Anki deck file downloaded: ${filename}\n\nTo study in Anki:\n1. Open Anki\n2. Click "File" > "Import"\n3. Select ${filename}\n\nAll cards are cleanly formatted and separated with comment dividers!`);
      } else {
        alert(`✅ Structured revision deck downloaded: ${filename}\n\nOpen this file in Notepad or any text editor for clean, boxed study cards!`);
      }
    } catch (error) {
      alert('Failed to export flashcards: ' + (error.response?.data?.error?.message || error.message));
    }
  };

  const regenerateFlashcards = async (contentId) => {
    if (!window.confirm('Regenerate fresh, high-quality AI flashcards for this material? Existing cards will be updated with deep conceptual questions.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await client.post('/flashcards/generate', { contentId, count: 15, forceRegenerate: true });
      setFlashcards(res.data.data);
      setCurrentIndex(0);
      setMode('study');
      fetchStats();
      fetchAllFlashcards();
    } catch (error) {
      alert(error.response?.data?.error?.message || 'Failed to regenerate flashcards');
    } finally {
      setLoading(false);
    }
  };

  const currentCard = flashcards[currentIndex];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <Layers className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold text-text-primary">Flashcards</h1>
        </div>
        <p className="text-text-secondary">Quick revision with spaced repetition</p>
      </motion.div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
            <p className="text-xs text-text-secondary">Total Cards</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-success">{stats.mastered}</p>
            <p className="text-xs text-text-secondary">Mastered</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-primary">{stats.learning}</p>
            <p className="text-xs text-text-secondary">Learning</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-warning">{stats.new}</p>
            <p className="text-xs text-text-secondary">New</p>
          </Card>
          <Card className="text-center">
            <p className="text-2xl font-bold text-danger">{stats.dueForReview}</p>
            <p className="text-xs text-text-secondary">Due Today</p>
          </Card>
        </div>
      )}

      {/* Select Content Mode */}
      {mode === 'select' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Select Content</h2>
              <p className="text-sm text-text-secondary">Study flashcards or export clean decks</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport(null, 'anki')}
                title="Download all flashcards formatted for Anki (.txt)"
              >
                <Download className="w-4 h-4 mr-1.5 inline" />
                Export Anki (.txt)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleExport(null, 'structured')}
                title="Download all flashcards in human-readable boxed layout (.txt)"
              >
                <FileText className="w-4 h-4 mr-1.5 inline text-accent" />
                Structured Notes (.txt)
              </Button>
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search flashcards by content title or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border-2 border-border rounded-lg focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          {contents.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-600">No content available. Upload some study materials first!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contents
                .filter(content =>
                  content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (content.topics && content.topics.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
                )
                .map(content => {
                  const flashcardCount = contentFlashcardCounts[content._id] || 0;
                  const hasFlashcards = flashcardCount > 0;

                  return (
                    <Card key={content._id} className="hover:shadow-lg transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="text-primary">
                            {content.type === 'pdf' && <FileText className="w-8 h-8" />}
                            {content.type === 'youtube' && <Play className="w-8 h-8" />}
                            {content.type === 'text' && <Layers className="w-8 h-8" />}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold line-clamp-2">{content.title}</h3>
                            <p className="text-xs text-text-secondary capitalize">{content.type}</p>
                            {hasFlashcards && (
                              <p className="text-xs text-success font-medium mt-1">
                                <CheckCircle className="w-3 h-3 inline mr-1" />
                                {flashcardCount} flashcards
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mt-4 pt-3 border-t border-border">
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={() => {
                              setSelectedContent(content);
                              generateFlashcards(content._id);
                            }}
                            loading={loading}
                          >
                            {hasFlashcards ? (
                              <>
                                <Play className="w-4 h-4 mr-2 inline" />
                                Study ({flashcardCount})
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2 inline" />
                                Generate Cards
                              </>
                            )}
                          </Button>
                          {hasFlashcards && (
                            <Button
                              variant="secondary"
                              className="px-3"
                              title="Regenerate deep conceptual flashcards with AI"
                              onClick={() => regenerateFlashcards(content._id)}
                            >
                              <RefreshCw className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          {hasFlashcards && (
                            <Button
                              variant="secondary"
                              className="px-3 hover:text-danger hover:border-danger"
                              title="Delete Flashcards"
                              onClick={() => deleteFlashcards(content._id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {hasFlashcards && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handleExport(content, 'anki')}
                              className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md border border-border bg-bg-secondary hover:bg-bg-tertiary text-text-primary transition-all cursor-pointer"
                              title="Export Anki-compatible TSV deck (.txt)"
                            >
                              <Download className="w-3.5 h-3.5 text-primary" />
                              Export Anki
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExport(content, 'structured')}
                              className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-semibold rounded-md border border-border bg-bg-secondary hover:bg-bg-tertiary text-text-primary transition-all cursor-pointer"
                              title="Export human-readable structured notes (.txt)"
                            >
                              <FileText className="w-3.5 h-3.5 text-accent" />
                              Clean Notes
                            </button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Study Mode */}
      {mode === 'study' && currentCard && (
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-secondary">
                Card {currentIndex + 1} of {flashcards.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExport(selectedContent, 'anki')}
                  title="Export this deck for Anki"
                >
                  <Download className="w-3.5 h-3.5 mr-1 inline" />
                  Anki
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExport(selectedContent, 'structured')}
                  title="Export this deck as structured notes"
                >
                  <FileText className="w-3.5 h-3.5 mr-1 inline" />
                  Notes
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setMode('select')}>
                  Back
                </Button>
              </div>
            </div>
            <div className="w-full bg-border rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Flashcard */}
          <motion.div
            key={currentCard._id}
            className="relative h-96 cursor-pointer"
            style={{ x, rotate, opacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front - Question */}
            {!isFlipped && (
              <Card className="absolute inset-0 flex items-center justify-center text-center p-8 bg-bg-primary border-2 border-border">
                <div>
                  <p className="text-sm text-text-secondary mb-4">Question</p>
                  <p className="text-2xl font-bold text-text-primary">{currentCard.front}</p>
                  <p className="text-sm text-text-secondary mt-6">Tap to flip</p>
                </div>
              </Card>
            )}

            {/* Back - Answer */}
            {isFlipped && (
              <Card className="absolute inset-0 flex items-center justify-center text-center p-8 bg-bg-primary border-2 border-border">
                <div>
                  <p className="text-sm text-text-secondary mb-4">Answer</p>
                  <p className="text-xl text-text-primary">{currentCard.back}</p>
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <span className="px-3 py-1 bg-primary bg-opacity-10 text-primary rounded-full text-xs border border-primary">
                      {currentCard.topic}
                    </span>
                    <span className="px-3 py-1 bg-primary bg-opacity-10 text-primary rounded-full text-xs border border-primary">
                      {currentCard.difficulty}
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>

          {/* Swipe Instructions */}
          <div className="flex items-center justify-between mt-8">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSwipe(false)}
              className="flex items-center gap-2 px-6 py-3 bg-danger text-white rounded-lg font-medium shadow-lg"
            >
              <XCircle className="w-4 h-4" />
              Don't Know
            </motion.button>

            <p className="text-sm text-text-secondary">Swipe or tap buttons</p>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleSwipe(true)}
              className="flex items-center gap-2 px-6 py-3 bg-success text-white rounded-lg font-medium shadow-lg"
            >
              <CheckCircle className="w-4 h-4" />
              Know It
            </motion.button>
          </div>

          {/* Mastery Level */}
          <div className="mt-6 text-center">
            <p className="text-sm text-text-secondary mb-2">Mastery Level</p>
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2, 3, 4, 5].map(level => (
                <div
                  key={level}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    level <= currentCard.masteryLevel
                      ? 'bg-success text-white'
                      : 'bg-border text-text-secondary'
                  }`}
                >
                  {level}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Complete Mode */}
      {mode === 'complete' && (
        <Card className="max-w-2xl mx-auto text-center py-12">
          <div className="mb-4">
            <CheckCircle className="w-16 h-16 text-success mx-auto" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-text-primary">Session Complete!</h2>
          <p className="text-text-secondary mb-8">
            You've reviewed {flashcards.length} flashcards
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="secondary" onClick={() => setMode('select')}>
              Back to Library
            </Button>
            <Button variant="secondary" onClick={() => handleExport(selectedContent, 'anki')}>
              <Download className="w-4 h-4 mr-1.5 inline" />
              Export Anki (.txt)
            </Button>
            <Button variant="secondary" onClick={() => handleExport(selectedContent, 'structured')}>
              <FileText className="w-4 h-4 mr-1.5 inline text-accent" />
              Structured Notes (.txt)
            </Button>
            <Button onClick={() => {
              setCurrentIndex(0);
              setMode('study');
            }}>
              Study Again
            </Button>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="text-center py-12 px-8">
            <motion.div
              className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-gray-600">Generating flashcards...</p>
          </Card>
        </div>
      )}
    </div>
  );
};
