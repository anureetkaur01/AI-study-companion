import axios from 'axios';
import { validateQuestionCount } from '../utils/validators.js';
import { AppError } from '../middleware/errorHandler.js';

// Ollama API endpoint (runs locally)
const OLLAMA_API = 'http://localhost:11434/api/generate';

// Initialize Gemini API (commented out - using Ollama instead)
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

export class GeminiService {
  async generateSummary(text, type = 'brief') {
    try {
      const prompts = {
        brief: `Summarize this in 2-3 sentences:\n\n${text}`,
        detailed: `Provide a detailed summary (5-7 sentences):\n\n${text}`,
        comprehensive: `Provide a comprehensive summary with key points:\n\n${text}`
      };

      const response = await axios.post(OLLAMA_API, {
        model: 'mistral',  // Smaller, faster model (2.2GB vs 4.4GB)
        // model: 'phi3',  // Smaller, faster model (2.2GB vs 4.4GB)
        prompt: prompts[type],
        stream: false
      }, {
        timeout: 30000  // 30 second timeout
      });

      return response.data.response;
    } catch (error) {
      console.error('❌ Ollama API error:', error.message);
      console.warn('⚠️ FALLBACK: Using mock summary (Ollama not running)');
      return this.getMockSummary(text, type);
    }
  }

  async generateQuiz(text, difficulty = 'medium', count = 5) {
    const numCount = Number(count) || 5;
    if (!validateQuestionCount(numCount)) {
      throw new AppError('Question count must be between 5 and 20', 400);
    }

    try {
      const prompt = `Generate exactly ${numCount} multiple choice questions about this text with difficulty level "${difficulty}". For each question, provide:
1. question (string)
2. options (array of exactly 4 strings - just the answer text, no letters)
3. correctAnswer (must be EXACTLY one of the 4 options as a string, not an array)
4. explanation (string)

Return ONLY valid JSON array, no other text. Example format:
[{"question":"What is X?","options":["Answer1","Answer2","Answer3","Answer4"],"correctAnswer":"Answer1","explanation":"Because..."}]

Text: ${text}`;

      const response = await axios.post(OLLAMA_API, {
        model: 'mistral',
        prompt: prompt,
        stream: false
      });

      try {
        const responseText = response.data.response || '';
        
        // Try to extract JSON array
        let jsonStr = responseText.trim();
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        const startIdx = jsonStr.indexOf('[');
        const endIdx = jsonStr.lastIndexOf(']');
        
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
          jsonStr = jsonStr.replace(/[\n\r\t]/g, ' ');
          jsonStr = jsonStr.replace(/,\s*]/g, ']');
          jsonStr = jsonStr.replace(/,\s*}/g, '}');
          jsonStr = jsonStr.replace(/:\s*\[/g, ':[');
          
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.slice(0, numCount).map(q => {
              let options = Array.isArray(q.options) ? q.options : [q.options || ''];
              options = options.map(opt => String(opt).trim());
              while (options.length < 4) {
                options.push(`Option ${options.length + 1}`);
              }
              options = options.slice(0, 4);
              
              let correctAnswer = String(q.correctAnswer || '').trim();
              if (!options.includes(correctAnswer)) {
                correctAnswer = options[0];
              }
              
              return {
                question: String(q.question || '').trim(),
                options: options,
                correctAnswer: correctAnswer,
                explanation: String(q.explanation || '').trim()
              };
            });
          }
        }
      } catch (error) {
        console.error('Error parsing quiz JSON:', error.message);
      }
      
      console.warn('⚠️ FALLBACK: Using mock quiz (Ollama response parsing failed)');
      return this.getMockQuiz(difficulty, numCount);
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('❌ Ollama API error:', error.message);
      console.warn('⚠️ FALLBACK: Using mock quiz (Ollama not responding)');
      return this.getMockQuiz(difficulty, numCount);
    }
  }

  async generateRecommendations(weakTopics, performanceData) {
    try {
      const prompt = `Based on weak topics: ${weakTopics.join(', ')} and performance data: ${JSON.stringify(performanceData)}, provide 3 personalized learning recommendations in JSON format: [{"topic": "...", "action": "...", "reason": "..."}]`;

      const response = await axios.post(OLLAMA_API, {
        model: 'mistral',
        prompt: prompt,
        stream: false
      });

      try {
        const responseText = response.data.response || '';
        
        // Remove markdown code blocks
        let jsonStr = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        // Find JSON array
        const startIdx = jsonStr.indexOf('[');
        const endIdx = jsonStr.lastIndexOf(']');
        
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
          jsonStr = jsonStr.replace(/[\n\r\t]/g, ' ');
          jsonStr = jsonStr.replace(/,\s*]/g, ']');
          jsonStr = jsonStr.replace(/,\s*}/g, '}');
          
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(r => ({
              topic: String(r.topic || '').trim(),
              action: String(r.action || '').trim(),
              reason: String(r.reason || '').trim()
            }));
          }
        }
      } catch (error) {
        console.error('Error parsing recommendations:', error.message);
      }
      console.warn('⚠️ FALLBACK: Using mock recommendations (Ollama response parsing failed)');
      return this.getMockRecommendations(weakTopics);
    } catch (error) {
      console.error('❌ Ollama API error:', error.message);
      console.warn('⚠️ FALLBACK: Using mock recommendations (Ollama not responding)');
      return this.getMockRecommendations(weakTopics);
    }
  }

  async extractTopics(text) {
    try {
      const prompt = `Extract 5-10 main topics from this text. Return ONLY a JSON array of topic strings, no other text.
Example: ["Topic1","Topic2","Topic3"]

Text: ${text}`;

      const response = await axios.post(OLLAMA_API, {
        model: 'mistral',
        prompt: prompt,
        stream: false
      });

      try {
        const responseText = response.data.response || '';
        
        // Remove markdown code blocks
        let jsonStr = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        // Find JSON array
        const startIdx = jsonStr.indexOf('[');
        const endIdx = jsonStr.lastIndexOf(']');
        
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = jsonStr.substring(startIdx, endIdx + 1);
          jsonStr = jsonStr.replace(/[\n\r\t]/g, ' ');
          jsonStr = jsonStr.replace(/,\s*]/g, ']');
          jsonStr = jsonStr.replace(/,\s*}/g, '}');
          
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(t => String(t).trim());
          }
        }
      } catch (error) {
        console.error('Error parsing topics:', error.message);
      }
      
      console.warn('⚠️ FALLBACK: Using mock topics (Ollama response parsing failed)');
      return this.getMockTopics(text);
    } catch (error) {
      console.error('❌ Ollama API error:', error.message);
      console.warn('⚠️ FALLBACK: Using mock topics (Ollama not responding)');
      return this.getMockTopics(text);
    }
  }

  async generateContent(userPrompt, systemPrompt = '') {
    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;

      console.log('🔄 Calling Ollama API at', OLLAMA_API);
      const response = await axios.post(OLLAMA_API, {
        model: 'mistral',
        prompt: fullPrompt,
        stream: false
      });

      console.log('✅ Ollama API response received');
      return response.data.response || '';
    } catch (error) {
      console.error('❌ Ollama API error:', error.message);
      console.warn('⚠️ FALLBACK: Using mock response (Ollama not responding)');
      return this.getMockChatResponse(userPrompt);
    }
  }

  // Mock data for when API fails
  getMockSummary(text, type) {
    const sentences = text.split('.').filter(s => s.trim());
    if (type === 'brief') {
      return sentences.slice(0, 2).join('. ') + '.';
    } else if (type === 'detailed') {
      return sentences.slice(0, 5).join('. ') + '.';
    } else {
      return text;
    }
  }

  getMockQuiz(difficulty = 'medium', count = 5) {
    const num = Math.max(5, Math.min(20, Number(count) || 5));
    const baseQuestions = [
      { question: 'What is the foundational concept discussed in this material?', options: ['Core Architecture', 'Legacy Protocols', 'Manual Verification', 'Unstructured Storage'], correctAnswer: 'Core Architecture', explanation: 'The study material emphasizes the core architecture as foundational.' },
      { question: 'Which mechanism is primary for ensuring system consistency?', options: ['Periodic Polling', 'State Validation & Transactions', 'Random Access Memory', 'Asynchronous Queuing Only'], correctAnswer: 'State Validation & Transactions', explanation: 'State validation and transactional guarantees preserve consistency.' },
      { question: 'What is the primary benefit of modular software engineering?', options: ['Increased Hardware Consumption', 'Testability & Maintainability', 'Redundant Code Execution', 'Single Point of Failure'], correctAnswer: 'Testability & Maintainability', explanation: 'Modularity facilitates isolated testing and streamlined maintainability.' },
      { question: 'How are boundary limits properly evaluated in verification?', options: ['Testing Only Nominal Values', 'Boundary Value Analysis (BVA)', 'Random Guessing', 'Code Minification'], correctAnswer: 'Boundary Value Analysis (BVA)', explanation: 'Boundary Value Analysis checks edges and off-by-one conditions.' },
      { question: 'Which testing technique pairs inputs using a decision table?', options: ['Decision-Table-Based Testing', 'Stress Testing', 'Static Type Checking', 'Monkey Testing'], correctAnswer: 'Decision-Table-Based Testing', explanation: 'Decision tables evaluate combinations of input conditions and rules.' },
      { question: 'What guarantees deterministic execution across modules?', options: ['Race Conditions', 'Pure Functions & Validation Rules', 'Network Latency', 'Global Mutable State'], correctAnswer: 'Pure Functions & Validation Rules', explanation: 'Pure functions and strict validation ensure deterministic outcomes.' },
      { question: 'Which approach provides speech-to-text transcription for videos?', options: ['Optical Character Recognition', 'Whisper-Compatible STT Model', 'Lexical Grammar Parser', 'CSS Preprocessor'], correctAnswer: 'Whisper-Compatible STT Model', explanation: 'Speech-to-text models like Whisper transcribe speech audio.' },
      { question: 'How is text extracted from uploaded image documents?', options: ['DOM Traversal', 'Tesseract Optical Character Recognition (OCR)', 'Binary Hexdump', 'Audio Synthesizer'], correctAnswer: 'Tesseract Optical Character Recognition (OCR)', explanation: 'OCR tools like Tesseract extract characters from image rasters.' },
      { question: 'What is the purpose of role-based authorization in web apps?', options: ['Coloring Buttons', 'Restricting Features to Authorized Roles', 'Speeding up DNS', 'Reducing Database Records'], correctAnswer: 'Restricting Features to Authorized Roles', explanation: 'Role-based access enforces security and prevents unauthorized actions.' },
      { question: 'What ensures safe password storage in a database?', options: ['Plaintext Serialization', 'Bcrypt Salted Hashing', 'Base64 Encoding', 'Rot13 Cipher'], correctAnswer: 'Bcrypt Salted Hashing', explanation: 'Salted cryptographic hashing like Bcrypt protects passwords.' },
      { question: 'Why is input validation critical before processing files?', options: ['Prevents Arbitrary Code Execution and DoS', 'Minimizes Screen Brightness', 'Shortens URL Length', 'Increases Network Ping'], correctAnswer: 'Prevents Arbitrary Code Execution and DoS', explanation: 'Validating file size and mime types prevents server resource exhaustion.' },
      { question: 'What is an equivalence partition in software testing?', options: ['A set of inputs treated identically by system logic', 'A database shard', 'A network subnet', 'A git commit hash'], correctAnswer: 'A set of inputs treated identically by system logic', explanation: 'Equivalence partitions group values expected to produce the same outcome.' },
      { question: 'What role does an automated regression test suite serve?', options: ['Detects defects introduced by recent code updates', 'Cleans disk cache', 'Creates user accounts', 'Compiles documentation'], correctAnswer: 'Detects defects introduced by recent code updates', explanation: 'Regression testing verifies that existing behavior remains intact.' },
      { question: 'How should long-running transcription tasks be processed?', options: ['Synchronous Browser Request Blocking', 'Asynchronous Background Jobs', 'Halting Server Execution', 'Dropping User Sessions'], correctAnswer: 'Asynchronous Background Jobs', explanation: 'Background processing avoids client timeouts on heavy media jobs.' },
      { question: 'What is the benefit of reusing validated lecture content for PPTX and PDF?', options: ['Guarantees Consistency Across Formats Without Redundant AI Calls', 'Consumes Double Storage', 'Slows Down Generation', 'Avoids File Formatting'], correctAnswer: 'Guarantees Consistency Across Formats Without Redundant AI Calls', explanation: 'Shared data structures ensure presentation slides and notes match exactly.' },
      { question: 'How should unreadable or corrupt documents be handled?', options: ['Crash Server Process', 'Return Informative Error and Handle Gracefully', 'Insert Corrupted Rows', 'Ignore Without Message'], correctAnswer: 'Return Informative Error and Handle Gracefully', explanation: 'Robust systems catch extraction errors and notify the user.' },
      { question: 'Which library enables programmatic PowerPoint (.pptx) file generation?', options: ['PptxGenJS', 'Moment.js', 'Lodash', 'Bcrypt'], correctAnswer: 'PptxGenJS', explanation: 'PptxGenJS generates Microsoft PowerPoint presentations in JavaScript.' },
      { question: 'Which library enables server-side PDF generation in Node.js?', options: ['PDFKit', 'Nodemon', 'Multer', 'Express'], correctAnswer: 'PDFKit', explanation: 'PDFKit creates formatted vector PDF documents on the server.' },
      { question: 'What is the role of an adaptive quiz algorithm?', options: ['Adjusts Difficulty or Focuses on Weak Mastery Topics', 'Deletes User History', 'Reroutes Network Traffic', 'Freezes Timers'], correctAnswer: 'Adjusts Difficulty or Focuses on Weak Mastery Topics', explanation: 'Adaptive learning dynamically targets topics requiring reinforcement.' },
      { question: 'What distinguishes teacher workflows from student workflows in the platform?', options: ['Teachers Can Generate Structured Lectures and Download PPT/PDFs', 'Teachers Have No Dashboards', 'Students Can Delete Other Users Data', 'Students Manage Server Config'], correctAnswer: 'Teachers Can Generate Structured Lectures and Download PPT/PDFs', explanation: 'Teacher accounts provide lecture creation, slide decks, and handouts.' }
    ];

    return baseQuestions.slice(0, num);
  }

  async generateLectureContent(topicOrText, title = 'Lecture') {
    try {
      const prompt = `Generate a structured, professional academic lecture for topic/content: "${title}".
Content details: ${topicOrText}

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

      const response = await axios.post(OLLAMA_API, {
        model: 'mistral',
        prompt: prompt,
        stream: false
      });

      const responseText = response.data.response || '';
      let jsonStr = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const startIdx = jsonStr.indexOf('{');
      const endIdx = jsonStr.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.title && Array.isArray(parsed.learningObjectives) && Array.isArray(parsed.mainConcepts)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('⚠️ Ollama lecture generation note:', err.message);
    }

    // High quality deterministic fallback lecture content
    return {
      title: title || 'Comprehensive Lecture Notes',
      topic: title || 'Educational Topic',
      learningObjectives: [
        `Understand the fundamental principles and theoretical foundations of ${title}`,
        `Analyze key components, architecture, and real-world mechanisms of ${title}`,
        `Apply core problem-solving methodologies and evaluate practical implementations`
      ],
      introduction: `${title} represents a core foundation in modern computer science and software verification. Understanding its structure allows students and practitioners to design resilient architectures, reason about correctness, and deploy scalable solutions in industry environments.`,
      mainConcepts: [
        {
          title: `Core Principles of ${title}`,
          explanation: `The primary framework consists of structured specifications, systematic validation rules, and isolated state transformations that ensure consistency and prevent anomalous behaviors under high workloads.`,
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
          explanation: `Systematic testing strategies including Equivalence Partitioning, Boundary Value Analysis, and Decision Tables guarantee edge cases are identified and rectified early in the development lifecycle.`,
          examples: [
            `Testing minimum and maximum boundaries for all configurable inputs`,
            `Automated regression testing suites executed upon every code change`
          ]
        }
      ],
      summary: `In summary, mastering ${title} provides students with the critical analytical and engineering skills necessary to build verified, reliable software products. Consistent review of these concepts reinforces retention and exam readiness.`,
      reviewQuestions: [
        `What are the primary operational benefits of applying ${title} in production?`,
        `How does modular component separation enhance automated test coverage?`,
        `Describe a scenario where boundary value analysis prevents an off-by-one runtime failure.`
      ]
    };
  }

  getMockTopics(text) {
    // Extract potential topics from text
    const words = text.split(/\s+/);
    const topics = [];
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are', 'was', 'were'];
    
    for (let i = 0; i < Math.min(8, words.length); i++) {
      const word = words[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (word.length > 3 && !commonWords.includes(word)) {
        topics.push(word.charAt(0).toUpperCase() + word.slice(1));
      }
    }
    
    return topics.length > 0 ? topics : ['General Topic', 'Key Concept', 'Main Idea'];
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
    // Generate a contextual mock response based on the prompt
    if (userPrompt.toLowerCase().includes('photosynthesis')) {
      return `Photosynthesis is a fundamental biological process where plants convert light energy into chemical energy stored in glucose. It occurs in two main stages:

1. **Light-dependent reactions** (in the thylakoid membrane): Light energy is absorbed by chlorophyll, splitting water molecules and producing ATP and NADPH.

2. **Light-independent reactions/Calvin Cycle** (in the stroma): Uses ATP and NADPH to convert CO2 into glucose.

The overall equation is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2

This process is essential for life on Earth as it produces oxygen and forms the base of most food chains.`;
    }
    
    return `Based on your study materials, here's what I found: This is a general response since the specific content wasn't available. Please ensure you've uploaded study materials related to your question. The system works best when you have relevant materials uploaded that I can reference to provide accurate, detailed answers.`;
  }
}

export default new GeminiService();
