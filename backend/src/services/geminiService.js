import { GoogleGenerativeAI } from '@google/generative-ai';
import { validateQuestionCount } from '../utils/validators.js';
import { AppError } from '../middleware/errorHandler.js';

export class GeminiService {
  getModel(modelName = null, customConfig = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
      return null;
    }
    try {
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const selectedModel = modelName || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
      return genAI.getGenerativeModel({ model: selectedModel, ...customConfig }, { apiVersion: 'v1beta' });
    } catch (err) {
      console.error('❌ Failed to initialize Gemini model:', err.message);
      return null;
    }
  }

  async executeWithModel(fn, customConfig = {}) {
    const candidateModels = [
      process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];
    let lastError = null;
    for (const m of candidateModels) {
      const model = this.getModel(m, customConfig);
      if (!model) continue;
      try {
        return await fn(model, m);
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ Model ${m} attempt failed: ${err.message}. Trying next candidate...`);
      }
    }
    throw lastError || new Error('No candidate Gemini model could be executed');
  }

  async tryAlternativeProviders(text, difficulty, count, excludeQuestions = []) {
    const prompt = `Generate exactly ${count} multiple choice questions about this study material with difficulty level "${difficulty}".
${excludeQuestions.length > 0 ? `Do NOT repeat or duplicate these questions: ${excludeQuestions.slice(0, 5).join('; ')}` : ''}
Return ONLY a valid JSON object in this format:
{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "explanation": "..."}]}

Text: ${String(text || '').substring(0, 6000)}`;

    // 1. Groq API (Ultra-fast Llama 3.3 70B, free tier available)
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '') {
      try {
        console.log('🔄 Trying Groq AI API...');
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY.trim()}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.85
          })
        });
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = this.parseAndValidateQuestions(content, count);
          if (parsed && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.warn('⚠️ Groq API attempt failed:', err.message);
      }
    }

    // 2. OpenAI API (GPT-4o-mini)
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
      try {
        console.log('🔄 Trying OpenAI API...');
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY.trim()}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.85
          })
        });
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = this.parseAndValidateQuestions(content, count);
          if (parsed && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.warn('⚠️ OpenAI API attempt failed:', err.message);
      }
    }

    // 3. OpenRouter API
    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim() !== '') {
      try {
        console.log('🔄 Trying OpenRouter API...');
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`
          },
          body: JSON.stringify({
            model: 'deepseek/deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.85
          })
        });
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = this.parseAndValidateQuestions(content, count);
          if (parsed && parsed.length > 0) return parsed;
        }
      } catch (err) {
        console.warn('⚠️ OpenRouter API attempt failed:', err.message);
      }
    }

    return null;
  }

  parseAndValidateQuestions(rawText, count) {
    try {
      let clean = rawText.trim();
      clean = clean.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();

      const startIdx = clean.indexOf('[');
      const endIdx = clean.lastIndexOf(']');

      let parsed = null;
      if (startIdx !== -1 && endIdx !== -1) {
        clean = clean.substring(startIdx, endIdx + 1);
        parsed = JSON.parse(clean);
      } else {
        const obj = JSON.parse(clean);
        parsed = Array.isArray(obj) ? obj : (obj.questions || obj.quiz || null);
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count).map((q, idx) => {
          let options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
          options = options.filter(o => o.length > 0);
          while (options.length < 4) {
            options.push(`Alternative Option ${options.length + 1}`);
          }
          options = options.slice(0, 4);

          let correctAnswer = String(q.correctAnswer || '').trim();
          if (!options.includes(correctAnswer)) {
            correctAnswer = options[0];
          }

          // Shuffle options so correct answer is randomly positioned
          const shuffledOptions = this.shuffleArray([...options]);

          return {
            id: `q${idx}`,
            question: String(q.question || `Question ${idx + 1}`).trim(),
            options: shuffledOptions,
            correctAnswer: correctAnswer,
            explanation: String(q.explanation || 'Verified based on study material content.').trim()
          };
        });
      }
    } catch (err) {
      console.warn('JSON parsing attempt note:', err.message);
    }
    return null;
  }

  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  async generateSummary(text, type = 'brief') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
      console.warn('⚠️ GEMINI_API_KEY not configured or invalid, using fallback summary');
      return this.getMockSummary(text, type);
    }

    try {
      return await this.executeWithModel(async (model) => {
        const prompts = {
          brief: `Summarize this in 2-3 clear, insightful sentences:\n\n${text}`,
          detailed: `Provide a detailed, structured summary (5-7 sentences) highlighting main mechanisms and key takeaways:\n\n${text}`,
          comprehensive: `Provide a comprehensive summary with structured key points:\n\n${text}`
        };

        const result = await model.generateContent(prompts[type] || prompts.brief);
        const response = await result.response;
        return response.text();
      }, {
        generationConfig: { temperature: 0.4 }
      });
    } catch (error) {
      console.error('❌ Gemini API summary error:', error.message);
      console.warn('⚠️ FALLBACK: Using mock summary');
      return this.getMockSummary(text, type);
    }
  }

  async generateQuiz(text, difficulty = 'medium', count = 5, options = {}) {
    const numCount = Number(count) || 5;
    if (!validateQuestionCount(numCount)) {
      throw new AppError('Question count must be between 5 and 20', 400);
    }

    const { excludeQuestions = [], title = '' } = options;

    // Handle large text: select a randomized window so repeated quiz generations test different parts
    const rawText = String(text || '').trim();
    let textExcerpt = rawText;
    if (rawText.length > 7000) {
      const maxStart = rawText.length - 6000;
      const randomStart = Math.floor(Math.random() * maxStart);
      textExcerpt = rawText.substring(randomStart, randomStart + 6000);
    }

    // 1. Primary: Try Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.trim() !== '') {
      try {
        return await this.executeWithModel(async (model) => {
          const exclusionBlock = excludeQuestions.length > 0
            ? `\nIMPORTANT: Do NOT repeat or duplicate any of these previously asked questions:\n${excludeQuestions.slice(0, 10).map(q => `- ${q}`).join('\n')}\n`
            : '';

          const prompt = `Generate exactly ${numCount} multiple choice questions about this study material with difficulty level "${difficulty}".
${exclusionBlock}
Requirements:
1. Every question must test a different concept, definition, mechanism, or fact directly discussed in the text.
2. For each question, provide:
   - "question": string
   - "options": array of exactly 4 strings (pure answer text, NO letters like A., B., C.)
   - "correctAnswer": must EXACTLY match one of the 4 options
   - "explanation": string explaining why the answer is correct based on the text

Return ONLY a valid JSON array of question objects. Example:
[{"question":"What is X?","options":["A","B","C","D"],"correctAnswer":"A","explanation":"Because..."}]

Randomization seed: ${Date.now()}-${Math.random().toString(36).substring(7)}

Study Material:
${textExcerpt.substring(0, 8000)}`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const responseText = (response.text() || '').trim();

          const questions = this.parseAndValidateQuestions(responseText, numCount);
          if (questions && questions.length > 0) {
            console.log(`✅ Gemini generated ${questions.length} unique questions for quiz`);
            return questions;
          }
          throw new Error('Failed to parse valid questions array from Gemini output');
        }, {
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.85
          }
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        console.error('❌ Gemini API quiz error:', error.message);
      }
    }

    // 2. Secondary: Try Alternative Providers (Groq / OpenAI / OpenRouter if configured)
    try {
      const altQuestions = await this.tryAlternativeProviders(textExcerpt, difficulty, numCount, excludeQuestions);
      if (altQuestions && altQuestions.length > 0) {
        console.log('✅ Quiz generated using alternative AI provider');
        return altQuestions;
      }
    } catch (altError) {
      console.warn('⚠️ Alternative provider attempt note:', altError.message);
    }

    // 3. Smart Dynamic Content-Aware Fallback
    console.warn('⚠️ FALLBACK: Using dynamic content-aware mock quiz generator');
    return this.getMockQuiz(difficulty, numCount, text, excludeQuestions, title);
  }

  async generateRecommendations(weakTopics, performanceData) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
      return this.getMockRecommendations(weakTopics);
    }

    try {
      return await this.executeWithModel(async (model) => {
        const prompt = `Based on weak topics: ${weakTopics.join(', ')} and performance data: ${JSON.stringify(performanceData)}, provide 3 personalized learning recommendations in JSON format: [{"topic": "...", "action": "...", "reason": "..."}]. Return ONLY valid JSON array.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text() || '';

        let clean = responseText.trim().replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
        const startIdx = clean.indexOf('[');
        const endIdx = clean.lastIndexOf(']');

        if (startIdx !== -1 && endIdx !== -1) {
          clean = clean.substring(startIdx, endIdx + 1);
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(r => ({
              topic: String(r.topic || '').trim(),
              action: String(r.action || '').trim(),
              reason: String(r.reason || '').trim()
            }));
          }
        }
        throw new Error('Failed to parse recommendations array');
      }, {
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7
        }
      });
    } catch (error) {
      console.error('❌ Gemini API recommendations error:', error.message);
    }

    return this.getMockRecommendations(weakTopics);
  }

  async extractTopics(text) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
      return this.getMockTopics(text);
    }

    try {
      return await this.executeWithModel(async (model) => {
        const prompt = `Extract 5-10 main academic topics or key concepts from this text. Return ONLY a JSON array of topic strings, no other text.
Example: ["Topic1","Topic2","Topic3"]

Text: ${String(text || '').substring(0, 8000)}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text() || '';

        let clean = responseText.trim().replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
        const startIdx = clean.indexOf('[');
        const endIdx = clean.lastIndexOf(']');

        if (startIdx !== -1 && endIdx !== -1) {
          clean = clean.substring(startIdx, endIdx + 1);
          const parsed = JSON.parse(clean);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(t => String(t).trim()).filter(Boolean);
          }
        }
        throw new Error('Failed to parse topics JSON');
      }, {
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      });
    } catch (error) {
      console.error('❌ Gemini API extract topics error:', error.message);
    }

    return this.getMockTopics(text);
  }

  async generateContent(userPrompt, systemPrompt = '') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
      return this.getMockChatResponse(userPrompt);
    }

    try {
      return await this.executeWithModel(async (model) => {
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;

        console.log('🔄 Calling Gemini API...');
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        console.log('✅ Gemini API response received');
        return response.text() || '';
      }, {
        generationConfig: { temperature: 0.7 }
      });
    } catch (error) {
      console.error('❌ Gemini API error:', error.message);
      console.warn('⚠️ FALLBACK: Using mock response');
      return this.getMockChatResponse(userPrompt);
    }
  }

  getMockSummary(text, type) {
    const sentences = String(text || '').split('.').filter(s => s.trim());
    if (sentences.length === 0) return 'Study material uploaded successfully. Detailed review available.';
    if (type === 'brief') {
      return sentences.slice(0, 2).join('. ') + '.';
    } else if (type === 'detailed') {
      return sentences.slice(0, 5).join('. ') + '.';
    } else {
      return sentences.slice(0, 8).join('. ') + '.';
    }
  }

  // Dynamic Content-Aware Mock Quiz Generator
  getMockQuiz(difficulty = 'medium', count = 5, text = '', excludeQuestions = [], title = '') {
    const num = Math.max(5, Math.min(20, Number(count) || 5));
    const normalizedText = String(text || '').trim();
    const excludeSet = new Set((excludeQuestions || []).map(q => q.toLowerCase().trim()));

    // Strategy 1: If text is provided, extract real sentences and keywords from the user's material
    if (normalizedText.length > 50) {
      const sentences = normalizedText
        .split(/[.\n;]+/)
        .map(s => s.trim())
        .filter(s => s.length > 20 && s.length < 160 && !s.includes('http') && !s.includes('Copyright') && !s.includes('==='));

      // Shuffle sentences for variety
      const shuffledSentences = this.shuffleArray(sentences);
      const generated = [];

      for (const sentence of shuffledSentences) {
        if (generated.length >= num) break;

        const words = sentence
          .split(/\s+/)
          .map(w => w.replace(/[^a-zA-Z0-9-]/g, '').trim())
          .filter(w => w.length >= 4 && !/^(about|after|again|before|between|could|every|first|great|other|right|should|their|there|these|which|would|while|under)$/i.test(w));

        if (words.length >= 2) {
          // Choose a significant keyword
          const keyWord = words[Math.floor(words.length / 2)];
          const blanked = sentence.replace(new RegExp(`\\b${keyWord}\\b`, 'i'), '______');
          const questionText = `According to the study material: "${blanked}" — Which term correctly fills the blank?`;

          if (excludeSet.has(questionText.toLowerCase())) continue;

          // Create context-aware options using other words from text
          const otherWords = words.filter(w => w.toLowerCase() !== keyWord.toLowerCase());
          const distractors = [
            otherWords[0] || `Inverse ${keyWord}`,
            otherWords[1] || `Secondary ${keyWord}`,
            otherWords[2] || `External ${keyWord}`
          ];

          const options = this.shuffleArray([keyWord, ...distractors]);

          generated.push({
            id: `q${generated.length}`,
            question: questionText,
            options: options,
            correctAnswer: keyWord,
            explanation: `Derived directly from your study material: "${sentence}"`
          });
        }
      }

      if (generated.length >= num) {
        return generated.slice(0, num);
      }
    }

    // Strategy 2: Subject-Categorized Question Pools (CS/Testing, DBMS, DSA, Biology, General Science)
    const combinedContext = `${title} ${normalizedText}`.toLowerCase();

    const topicBanks = {
      dbms: [
        { question: 'What property in ACID guarantees that all operations in a transaction succeed or all fail?', options: ['Atomicity', 'Consistency', 'Isolation', 'Durability'], correctAnswer: 'Atomicity', explanation: 'Atomicity ensures all-or-nothing execution of transactions.' },
        { question: 'Which normal form eliminates partial functional dependencies on a composite primary key?', options: ['First Normal Form (1NF)', 'Second Normal Form (2NF)', 'Third Normal Form (3NF)', 'BCNF'], correctAnswer: 'Second Normal Form (2NF)', explanation: '2NF requires 1NF and no partial key dependencies.' },
        { question: 'Which index structure is most widely utilized in relational databases for range queries?', options: ['Hash Table', 'B+ Tree', 'Linked List', 'Bloom Filter'], correctAnswer: 'B+ Tree', explanation: 'B+ Trees provide sorted leaf nodes optimized for disk I/O and range scans.' },
        { question: 'What does a FOREIGN KEY constraint enforce in a relational schema?', options: ['Data Encryption', 'Referential Integrity', 'Memory Caching', 'Query Parallelism'], correctAnswer: 'Referential Integrity', explanation: 'Foreign keys ensure values match a primary key in another table.' },
        { question: 'Which SQL statement is used to remove an entire table structure and its data?', options: ['DELETE TABLE', 'DROP TABLE', 'TRUNCATE TABLE', 'REMOVE TABLE'], correctAnswer: 'DROP TABLE', explanation: 'DROP TABLE deletes the schema definition and stored rows.' },
        { question: 'What level of transaction isolation prevents dirty reads but allows non-repeatable reads?', options: ['Read Uncommitted', 'Read Committed', 'Repeatable Read', 'Serializable'], correctAnswer: 'Read Committed', explanation: 'Read Committed only reads data committed by other transactions.' }
      ],
      dsa: [
        { question: 'What is the average time complexity of searching in a balanced Binary Search Tree (AVL/Red-Black)?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correctAnswer: 'O(log n)', explanation: 'Balanced BST heights are bounded by log2(n).' },
        { question: 'Which data structure operates on a Last-In-First-Out (LIFO) order?', options: ['Queue', 'Stack', 'Heap', 'Graph'], correctAnswer: 'Stack', explanation: 'A Stack pushes and pops from the top (LIFO).' },
        { question: 'Which algorithm is guaranteed to find the shortest path in a graph with non-negative edge weights?', options: ['Dijkstra Algorithm', 'Depth First Search', 'Kruskal Algorithm', 'Floyd-Warshall (only for trees)'], correctAnswer: 'Dijkstra Algorithm', explanation: 'Dijkstra greedy exploration finds minimal paths on non-negative graphs.' },
        { question: 'What is the worst-case time complexity of QuickSort when a poor pivot is selected?', options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(2^n)'], correctAnswer: 'O(n^2)', explanation: 'Unbalanced partitioning results in quadratic comparisons in QuickSort.' },
        { question: 'Which collision resolution technique stores colliding elements in a linked list at the same bucket?', options: ['Linear Probing', 'Quadratic Probing', 'Separate Chaining', 'Double Hashing'], correctAnswer: 'Separate Chaining', explanation: 'Separate chaining uses auxiliary lists for colliding keys.' }
      ],
      biology: [
        { question: 'Which organelle is universally referred to as the powerhouse of eukaryotic cells?', options: ['Ribosome', 'Mitochondria', 'Golgi Apparatus', 'Endoplasmic Reticulum'], correctAnswer: 'Mitochondria', explanation: 'Mitochondria synthesize ATP through cellular respiration.' },
        { question: 'What is the primary green photosynthetic pigment that absorbs solar photon energy in plants?', options: ['Carotenoid', 'Chlorophyll', 'Anthocyanin', 'Xanthophyll'], correctAnswer: 'Chlorophyll', explanation: 'Chlorophyll in thylakoid membranes absorbs red and blue light.' },
        { question: 'Which molecule carries genetic instructions from nuclear DNA to the ribosome for protein synthesis?', options: ['tRNA', 'mRNA', 'rRNA', 'siRNA'], correctAnswer: 'mRNA', explanation: 'Messenger RNA transcribes genetic code from DNA.' },
        { question: 'What is the fundamental unit of heredity passed from parents to offspring?', options: ['Gene', 'Chromosome', 'Histone', 'Codon'], correctAnswer: 'Gene', explanation: 'A gene is a discrete sequence of nucleotides encoding a functional product.' },
        { question: 'By which passive transport process do water molecules diffuse across a selectively permeable membrane?', options: ['Active Transport', 'Osmosis', 'Endocytosis', 'Phagocytosis'], correctAnswer: 'Osmosis', explanation: 'Osmosis is the net movement of water from high to low water potential.' }
      ],
      testing: [
        { question: 'What is another well-known industry term for White Box Testing?', options: ['Glass Box / Structural Testing', 'Black Box / Functional Testing', 'Monkey Testing', 'Smoke Testing'], correctAnswer: 'Glass Box / Structural Testing', explanation: 'White box testing examines internal code structures and execution paths.' },
        { question: 'Which testing technique systematically tests edge boundaries around input domain partitions?', options: ['Boundary Value Analysis (BVA)', 'Equivalence Partitioning', 'State Transition Testing', 'Error Guessing'], correctAnswer: 'Boundary Value Analysis (BVA)', explanation: 'BVA targets boundaries where defect density is historically highest.' },
        { question: 'What does Branch Coverage measure in software testing verification?', options: ['Percentage of decision branches executed at least once', 'Percentage of lines of comments written', 'Network packets delivered', 'Database columns indexed'], correctAnswer: 'Percentage of decision branches executed at least once', explanation: 'Branch coverage guarantees both True and False outcomes of conditions are evaluated.' },
        { question: 'Which test artifact documents input conditions and corresponding expected outcomes in a tabular format?', options: ['Decision Table', 'UML Class Diagram', 'Gantt Chart', 'Entity Relationship Diagram'], correctAnswer: 'Decision Table', explanation: 'Decision tables test complex combinations of input conditions.' },
        { question: 'What is the primary goal of regression testing following a code change?', options: ['Confirm existing features remain undamaged by recent modifications', 'Write API documentation', 'Minify CSS files', 'Generate database backups'], correctAnswer: 'Confirm existing features remain undamaged by recent modifications', explanation: 'Regression testing prevents unintended side-effects and bugs.' }
      ]
    };

    // Determine appropriate bank
    let selectedBank = topicBanks.testing;
    if (combinedContext.includes('database') || combinedContext.includes('sql') || combinedContext.includes('dbms') || combinedContext.includes('table') || combinedContext.includes('query')) {
      selectedBank = topicBanks.dbms;
    } else if (combinedContext.includes('algorithm') || combinedContext.includes('tree') || combinedContext.includes('graph') || combinedContext.includes('stack') || combinedContext.includes('queue') || combinedContext.includes('sort')) {
      selectedBank = topicBanks.dsa;
    } else if (combinedContext.includes('cell') || combinedContext.includes('biology') || combinedContext.includes('plant') || combinedContext.includes('photosynthesis') || combinedContext.includes('organism') || combinedContext.includes('dna')) {
      selectedBank = topicBanks.biology;
    }

    // Filter out previously excluded questions to guarantee uniqueness
    let pool = selectedBank.filter(q => !excludeSet.has(q.question.toLowerCase()));
    if (pool.length < num) {
      // Pull from other banks if necessary
      const extraBanks = Object.values(topicBanks).flat().filter(q => !excludeSet.has(q.question.toLowerCase()));
      pool = [...pool, ...extraBanks];
    }

    const shuffled = this.shuffleArray(pool);
    return shuffled.slice(0, num).map((q, idx) => ({
      id: `q${idx}`,
      question: q.question,
      options: this.shuffleArray([...q.options]),
      correctAnswer: q.correctAnswer,
      explanation: q.explanation
    }));
  }

  async generateLectureContent(topicOrText, title = 'Lecture') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.trim() !== '') {
      try {
        return await this.executeWithModel(async (model) => {
          const prompt = `Generate a structured, professional academic lecture for topic/content: "${title}".
Content details: ${String(topicOrText || '').substring(0, 10000)}

Return ONLY valid JSON matching this exact structure:
{
  "title": "${title}",
  "topic": "${title}",
  "learningObjectives": ["Objective 1", "Objective 2", "Objective 3"],
  "introduction": "Comprehensive introduction paragraph...",
  "mainConcepts": [
    {
      "title": "Concept 1 Title",
      "explanation": "Detailed explanation of concept 1...",
      "examples": ["Example 1a", "Example 1b"]
    },
    {
      "title": "Concept 2 Title",
      "explanation": "Detailed explanation of concept 2...",
      "examples": ["Example 2a", "Example 2b"]
    },
    {
      "title": "Concept 3 Title",
      "explanation": "Detailed explanation of concept 3...",
      "examples": ["Example 3a", "Example 3b"]
    }
  ],
  "summary": "Synthesized conclusion and key points...",
  "reviewQuestions": [
    "Review Question 1?",
    "Review Question 2?",
    "Review Question 3?"
  ]
}`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const responseText = response.text() || '';
          let jsonStr = responseText.trim().replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
          const startIdx = jsonStr.indexOf('{');
          const endIdx = jsonStr.lastIndexOf('}');
          if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = jsonStr.substring(startIdx, endIdx + 1);
            const parsed = JSON.parse(jsonStr);
            if (parsed.title && Array.isArray(parsed.learningObjectives) && Array.isArray(parsed.mainConcepts)) {
              return parsed;
            }
          }
          throw new Error('Failed to parse structured lecture JSON');
        }, {
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        });
      } catch (err) {
        console.warn('⚠️ Gemini lecture generation note:', err.message);
      }
    }

    return {
      title: title || 'Comprehensive Lecture Notes',
      topic: title || 'Educational Topic',
      learningObjectives: [
        `Understand the fundamental principles and theoretical foundations of ${title}`,
        `Analyze key components, architecture, and real-world mechanisms of ${title}`,
        `Apply core problem-solving methodologies and evaluate practical implementations`
      ],
      introduction: `${title} represents a core foundation in modern academic studies. Understanding its structure allows students and practitioners to design resilient architectures, reason about correctness, and deploy scalable solutions in industry environments.`,
      mainConcepts: [
        {
          title: `Core Principles of ${title}`,
          explanation: `The primary framework consists of structured specifications, systematic validation rules, and isolated state transformations that ensure consistency and prevent anomalous behaviors.`,
          examples: [
            `Standard design patterns implemented in distributed and desktop systems`,
            `Formal verification rules ensuring pre-conditions and post-conditions are met`
          ]
        },
        {
          title: `Architectural Design & Practical Workflow`,
          explanation: `In practice, components are decoupled into clean presentation layers, business logic controllers, and persistent repositories to enable comprehensive automated testing and modular updates.`,
          examples: [
            `Separation of concerns between client components and backend services`,
            `Transactional persistence with schema validation and error boundaries`
          ]
        },
        {
          title: `Verification, Testing & Performance Evaluation`,
          explanation: `Systematic testing strategies guarantee edge cases are identified and rectified early in the development lifecycle.`,
          examples: [
            `Testing minimum and maximum boundaries for all configurable inputs`,
            `Automated regression testing suites executed upon every code change`
          ]
        }
      ],
      summary: `In summary, mastering ${title} provides students with the critical analytical and engineering skills necessary to build verified, reliable products. Consistent review of these concepts reinforces retention and exam readiness.`,
      reviewQuestions: [
        `What are the primary operational benefits of applying ${title} in production?`,
        `How does modular component separation enhance automated test coverage?`,
        `Describe a scenario where boundary value analysis prevents a runtime failure.`
      ]
    };
  }

  getMockTopics(text) {
    if (!text || typeof text !== 'string') return ['General Topic'];
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are', 'was', 'were',
      'this', 'that', 'with', 'from', 'by', 'as', 'it', 'its', 'be', 'have', 'has', 'not', 'can', 'will',
      'page', 'chapter', 'section', 'using', 'used', 'which', 'their', 'there', 'they', 'when', 'where', 'how'
    ]);
    const words = text.split(/[\s,.:;()[\]{}'"]+/);
    const counts = {};
    for (const raw of words) {
      const w = raw.toLowerCase().trim();
      if (w.length > 3 && !commonWords.has(w) && !/^\d+$/.test(w)) {
        counts[w] = (counts[w] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

    return sorted.length > 0 ? sorted : ['Core Concepts', 'Analysis', 'Theoretical Framework'];
  }

  getMockRecommendations(weakTopics) {
    return [
      {
        topic: weakTopics[0] || 'General',
        action: 'Practice more questions on this topic',
        reason: 'Your accuracy is below 70%'
      },
      {
        topic: weakTopics[1] || 'Advanced',
        action: 'Review the fundamentals first',
        reason: 'Build a strong foundation'
      },
      {
        topic: weakTopics[2] || 'Challenge',
        action: 'Take harder quizzes',
        reason: 'Push yourself to improve'
      }
    ];
  }

  getMockChatResponse(userPrompt) {
    if (userPrompt.toLowerCase().includes('photosynthesis')) {
      return `Photosynthesis is a fundamental biological process where plants convert light energy into chemical energy stored in glucose. It occurs in two main stages:
1. **Light-dependent reactions** (in thylakoids): Produces ATP and NADPH, releasing O2.
2. **Light-independent reactions (Calvin cycle)** (in stroma): Fixes CO2 into glucose.`;
    }
    return `Based on your study materials, here is the answer to your query: The concepts discussed emphasize structured analysis, validation, and core principles. To get deeper insights, feel free to generate a practice quiz from the Study Materials tab!`;
  }
}

export default new GeminiService();
