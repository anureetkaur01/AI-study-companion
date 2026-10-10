import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Presentation, FileText, Download, Sparkles, BookOpen, Trash2, 
  HelpCircle, Lightbulb, Target, AlertCircle, RefreshCw, CheckCircle2 
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import client from '../api/client';

export const TeacherLectures = () => {
  const [lectures, setLectures] = useState([]);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [topic, setTopic] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [materials, setMaterials] = useState([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    fetchLectures();
    fetchMaterials();
  }, []);

  const fetchLectures = async () => {
    setLoading(true);
    try {
      const res = await client.get('/teacher/lectures');
      const data = res.data.data || [];
      setLectures(data);
      if (data.length > 0 && !selectedLecture) {
        setSelectedLecture(data[0]);
      }
    } catch (err) {
      console.error('Failed to load lectures:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await client.get('/content');
      setMaterials(res.data.data || []);
    } catch (err) {
      console.error('Failed to load materials:', err);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!topic.trim() && !selectedMaterialId) {
      setError('Please provide a lecture topic or choose a study material.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await client.post('/teacher/lectures/generate', {
        topic: topic.trim(),
        title: customTitle.trim() || undefined,
        contentId: selectedMaterialId || undefined
      });

      const newLecture = res.data.data;
      setLectures([newLecture, ...lectures]);
      setSelectedLecture(newLecture);
      setTopic('');
      setCustomTitle('');
      setSelectedMaterialId('');
      setSuccessMsg('🎉 Lecture content generated successfully! Download ready.');
    } catch (err) {
      console.error('Lecture generation failed:', err);
      setError(err.response?.data?.error?.message || 'Failed to generate lecture content. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (lectureId) => {
    if (!window.confirm('Are you sure you want to delete this lecture material?')) return;
    try {
      await client.delete(`/teacher/lectures/${lectureId}`);
      const remaining = lectures.filter(l => l._id !== lectureId);
      setLectures(remaining);
      if (selectedLecture?._id === lectureId) {
        setSelectedLecture(remaining[0] || null);
      }
      setSuccessMsg('Lecture material deleted successfully.');
    } catch (err) {
      setError('Failed to delete lecture: ' + (err.response?.data?.error?.message || err.message));
    }
  };

  const handleDownload = async (lectureId, format) => {
    const lecture = lectures.find(l => l._id === lectureId) || selectedLecture;
    if (!lecture) return;

    setDownloadingFormat(format);
    setError(null);
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
      const safeTitle = (lecture.title || 'lecture').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${safeTitle}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Download ${format.toUpperCase()} failed:`, err);
      setError(`Failed to download ${format.toUpperCase()}: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-primary text-white rounded-2xl p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
              <Presentation className="w-4 h-4" /> Teacher Lecture Studio (FR-11, FR-12, FR-13)
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">AI Lecture & Presentation Generator</h1>
            <p className="text-blue-100 max-w-2xl text-sm leading-relaxed">
              Transform any academic topic, uploaded note, or transcript into structured lecture outlines, 
              ready-to-teach PowerPoint (.pptx) slide decks, and formatted PDF classroom handouts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 text-center">
              <p className="text-2xl font-bold">{lectures.length}</p>
              <p className="text-xs text-blue-200">Decks Created</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 text-sm font-bold ml-4">✕</button>
        </motion.div>
      )}

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-700 text-sm font-bold ml-4">✕</button>
        </motion.div>
      )}

      {/* Generation Form Card */}
      <Card className="bg-white border-2 border-border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Create New Lecture Materials</h2>
            <p className="text-xs text-gray-500">Provide a topic or pick an existing document to generate presentation and handout notes</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lecture Topic or Subject *
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Software Testing: Equivalence Partitioning & Boundary Value Analysis"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Custom Title (Optional)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Module 3: Verification Methodologies & Test Suites"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Or Source from Existing Study Material (Optional)
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
            >
              <option value="">-- None (Generate from Topic prompt directly) --</option>
              {materials.map(m => (
                <option key={m._id} value={m._id}>
                  {m.title} ({m.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={generating || (!topic.trim() && !selectedMaterialId)}
              className="px-6 py-2.5 flex items-center gap-2 text-sm font-semibold shadow-md"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Lecture Content & Decks...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Lecture Materials
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* Main Workspace: History and Detail Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Lecture List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
              Lecture Decks ({lectures.length})
            </h3>
            <button 
              onClick={fetchLectures} 
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {lectures.length === 0 ? (
            <Card className="p-8 text-center bg-gray-50 border border-dashed border-gray-300">
              <Presentation className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 mb-1">No Lecture Materials Yet</p>
              <p className="text-xs text-gray-500">
                Generate your first lecture above to get downloadable PPTX presentations and PDF notes.
              </p>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {lectures.map((lec) => {
                const isSelected = selectedLecture?._id === lec._id;
                return (
                  <motion.div
                    key={lec._id}
                    onClick={() => setSelectedLecture(lec)}
                    whileHover={{ scale: 1.01 }}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{lec.title}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(lec._id);
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Delete Lecture"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {lec.introduction || lec.summary}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      <span className="text-gray-400">
                        {new Date(lec.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(lec._id, 'pptx');
                          }}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded flex items-center gap-1 border border-amber-200"
                          title="Download PPTX"
                        >
                          <Presentation className="w-3 h-3" /> PPTX
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(lec._id, 'pdf');
                          }}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded flex items-center gap-1 border border-blue-200"
                          title="Download PDF"
                        >
                          <FileText className="w-3 h-3" /> PDF
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Lecture Content Preview & Download Actions */}
        <div className="lg:col-span-8">
          {selectedLecture ? (
            <Card className="bg-white border-2 border-border shadow-md p-6 space-y-6">
              {/* Header and Download Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
                    Topic: {selectedLecture.topic}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedLecture.title}</h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Generated on {new Date(selectedLecture.createdAt).toLocaleDateString()} • Ready for classroom delivery
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleDownload(selectedLecture._id, 'pptx')}
                    disabled={downloadingFormat === 'pptx'}
                    className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 text-xs font-semibold px-4 py-2.5 shadow-sm"
                  >
                    <Presentation className="w-4 h-4" />
                    {downloadingFormat === 'pptx' ? 'Generating PPTX...' : 'Download PPTX'}
                  </Button>

                  <Button
                    onClick={() => handleDownload(selectedLecture._id, 'pdf')}
                    disabled={downloadingFormat === 'pdf'}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 text-xs font-semibold px-4 py-2.5 shadow-sm"
                  >
                    <FileText className="w-4 h-4" />
                    {downloadingFormat === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
                  </Button>
                </div>
              </div>

              {/* Section 1: Learning Objectives */}
              {selectedLecture.learningObjectives?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Target className="w-4 h-4" />
                    <h3>Learning Objectives</h3>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 rounded-xl p-4 border border-gray-200">
                    {selectedLecture.learningObjectives.map((obj, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className="text-primary font-bold mt-0.5">•</span>
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Section 2: Introduction */}
              {selectedLecture.introduction && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <BookOpen className="w-4 h-4" />
                    <h3>Introduction & Academic Context</h3>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-200 whitespace-pre-wrap">
                    {selectedLecture.introduction}
                  </p>
                </div>
              )}

              {/* Section 3: Core Concepts & Explanations */}
              {selectedLecture.mainConcepts?.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Lightbulb className="w-4 h-4" />
                    <h3>Core Concepts & Explanations</h3>
                  </div>
                  <div className="space-y-3">
                    {selectedLecture.mainConcepts.map((concept, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                        <h4 className="font-bold text-sm text-gray-900">
                          {idx + 1}. {concept.title}
                        </h4>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {concept.explanation}
                        </p>
                        {concept.examples?.length > 0 && (
                          <div className="pt-2 border-t border-gray-200 mt-2">
                            <p className="text-xs font-semibold text-teal-700 mb-1">Practical Examples:</p>
                            <ul className="space-y-1">
                              {concept.examples.map((ex, exIdx) => (
                                <li key={exIdx} className="text-xs text-gray-600 flex items-start gap-2">
                                  <span className="text-teal-600">→</span>
                                  <span>{ex}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Summary */}
              {selectedLecture.summary && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <h3>Lecture Summary</h3>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-200 whitespace-pre-wrap">
                    {selectedLecture.summary}
                  </p>
                </div>
              )}

              {/* Section 5: Review & Discussion Questions */}
              {selectedLecture.reviewQuestions?.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <HelpCircle className="w-4 h-4" />
                    <h3>Review & Classroom Discussion Questions</h3>
                  </div>
                  <ol className="space-y-2 bg-gray-50 rounded-xl p-4 border border-gray-200">
                    {selectedLecture.reviewQuestions.map((q, idx) => (
                      <li key={idx} className="text-xs text-gray-800 flex items-start gap-2">
                        <span className="font-bold text-primary">{idx + 1}.</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center bg-gray-50 border-2 border-dashed border-gray-300">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">No Lecture Selected</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Select a lecture from the list on the left to preview its full academic contents and download PowerPoint or PDF notes.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
export default TeacherLectures;
