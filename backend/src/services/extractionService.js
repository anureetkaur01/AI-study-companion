import axios from 'axios';

export class ExtractionService {
  // Extract YouTube transcript
  async extractYouTubeTranscript(youtubeUrl) {
    try {
      // Extract video ID from URL
      let videoId = '';
      if (youtubeUrl.includes('youtube.com/watch?v=')) {
        videoId = youtubeUrl.split('v=')[1]?.split('&')[0] || '';
      } else if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1]?.split('?')[0] || '';
      }

      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Use YouTube transcript API
      const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;
      
      // Alternative: Use a free transcript API
      const response = await axios.get(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      // Extract transcript from page (simplified approach)
      // For production, use: npm install youtube-transcript-api
      const transcript = `YouTube Video Transcript\n\nVideo ID: ${videoId}\n\nNote: Transcript extraction in progress. Please provide the transcript manually for now.`;
      
      return transcript;
    } catch (error) {
      console.error('YouTube extraction error:', error.message);
      throw new Error('Failed to extract YouTube transcript');
    }
  }

  // Extract PDF text
  async extractPDFText(pdfUrl) {
    try {
      // Download PDF
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      // For production, use: npm install pdf-parse
      // const pdfParse = require('pdf-parse');
      // const data = await pdfParse(response.data);
      // return data.text;

      // Simplified approach for now
      const pdfText = `PDF Document\n\nURL: ${pdfUrl}\n\nNote: PDF text extraction in progress. Please paste the PDF content manually for now.`;
      
      return pdfText;
    } catch (error) {
      console.error('PDF extraction error:', error.message);
      throw new Error('Failed to extract PDF text');
    }
  }

  // Generate summary from text
  async generateSummary(text) {
    try {
      // This will use the Gemini service to generate summary
      // Import geminiService and use it
      const summary = text.substring(0, 500) + '...'; // Placeholder
      return summary;
    } catch (error) {
      console.error('Summary generation error:', error.message);
      throw new Error('Failed to generate summary');
    }
  }
}

export default new ExtractionService();
