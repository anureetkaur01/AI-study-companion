import Content from '../models/Content.js';
import { AppError } from '../middleware/errorHandler.js';

class RAGService {
  /**
   * Extract relevant excerpt centered around matching keywords in large documents
   */
  extractRelevantExcerpt(fullText, keywords, maxLength = 3500) {
    if (!fullText || typeof fullText !== 'string') return '';
    if (fullText.length <= maxLength) return fullText;

    const lower = fullText.toLowerCase();
    const matchIndices = [];

    for (const kw of keywords) {
      if (!kw || kw.length < 2) continue;
      let pos = 0;
      let count = 0;
      while ((pos = lower.indexOf(kw.toLowerCase(), pos)) !== -1 && count < 15) {
        matchIndices.push(pos);
        pos += kw.length;
        count++;
      }
    }

    if (matchIndices.length === 0) {
      // Return first substantive chunk
      return fullText.substring(0, maxLength);
    }

    // Cluster matches to find highest density
    matchIndices.sort((a, b) => a - b);
    const medianIndex = matchIndices[Math.floor(matchIndices.length / 2)];

    // Center window around median match
    const half = Math.floor(maxLength / 2);
    let start = Math.max(0, medianIndex - half);
    let end = Math.min(fullText.length, start + maxLength);

    // Adjust boundaries to nearest word boundaries
    if (start > 0) {
      const spaceIdx = fullText.indexOf(' ', start);
      if (spaceIdx !== -1 && spaceIdx < start + 60) {
        start = spaceIdx + 1;
      }
    }
    if (end < fullText.length) {
      const spaceIdx = fullText.lastIndexOf(' ', end);
      if (spaceIdx !== -1 && spaceIdx > end - 60) {
        end = spaceIdx;
      }
    }

    let excerpt = fullText.substring(start, end).trim();
    if (start > 0) excerpt = '...' + excerpt;
    if (end < fullText.length) excerpt = excerpt + '...';

    return excerpt;
  }

  /**
   * Retrieve relevant content based on user query
   */
  async retrieveRelevantContent(userId, query, limit = 5, targetContentId = null) {
    try {
      // Build filter: prioritize specific material if targetContentId provided
      let filter = { userId };
      if (targetContentId) {
        filter._id = targetContentId;
      }

      let userContent = await Content.find(filter).select('title originalText topics type summaries keyPoints');

      // If user has no specific content under targetContentId, fallback to user's materials
      if ((!userContent || userContent.length === 0) && targetContentId) {
        userContent = await Content.find({ userId }).select('title originalText topics type summaries keyPoints');
      }

      if (!userContent || userContent.length === 0) {
        return [];
      }

      // Extract keywords from query
      const queryKeywords = this.extractKeywords(query);

      // Score each content based on relevance
      const scoredContent = userContent.map(content => {
        let score = 0;

        // If targetContentId explicitly requested, give high base score
        if (targetContentId && content._id.toString() === targetContentId.toString()) {
          score += 50;
        }

        // Score based on title matches
        if (content.title) {
          const titleLower = content.title.toLowerCase();
          queryKeywords.forEach(keyword => {
            if (titleLower.includes(keyword)) {
              score += 15;
            }
          });
        }

        // Score based on topic matches
        if (content.topics && Array.isArray(content.topics)) {
          content.topics.forEach(topic => {
            const topicLower = topic.toLowerCase();
            queryKeywords.forEach(keyword => {
              if (topicLower.includes(keyword)) {
                score += 10;
              }
            });
          });
        }

        // Score based on key points
        if (content.keyPoints && Array.isArray(content.keyPoints)) {
          content.keyPoints.forEach(kp => {
            const kpLower = kp.toLowerCase();
            queryKeywords.forEach(keyword => {
              if (kpLower.includes(keyword)) {
                score += 5;
              }
            });
          });
        }

        // Score based on text occurrences
        if (content.originalText) {
          const textLower = content.originalText.toLowerCase();
          queryKeywords.forEach(keyword => {
            let count = 0;
            let pos = 0;
            while ((pos = textLower.indexOf(keyword, pos)) !== -1 && count < 50) {
              count++;
              pos += keyword.length;
            }
            score += count * 2;
          });
        }

        return {
          content,
          relevanceScore: score
        };
      });

      // Filter and sort items with matches (or top items if target material selected)
      let matchedItems = scoredContent
        .filter(item => item.relevanceScore > 0 || (targetContentId && item.content._id.toString() === targetContentId.toString()))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      // If no keyword match found at all, return the most recent uploaded material
      if (matchedItems.length === 0 && userContent.length > 0) {
        matchedItems = [{
          content: userContent[0],
          relevanceScore: 1
        }];
      }

      return matchedItems.map(({ content, relevanceScore }) => {
        const textExcerpt = this.extractRelevantExcerpt(content.originalText, queryKeywords, 3500);

        return {
          id: content._id,
          title: content.title,
          type: content.type,
          topics: content.topics || [],
          text: textExcerpt,
          summaries: content.summaries,
          relevanceScore
        };
      });
    } catch (error) {
      console.error('RAG retrieval error:', error);
      return [];
    }
  }

  /**
   * Extract keywords from query
   */
  extractKeywords(query) {
    if (!query || typeof query !== 'string') return [];

    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are', 'was', 'were',
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'should', 'will',
      'do', 'does', 'did', 'be', 'been', 'being', 'have', 'has', 'had', 'tell', 'me', 'about', 'explain',
      'describe', 'define', 'give', 'show', 'please'
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  /**
   * Create context from retrieved content
   */
  createContext(retrievedContent) {
    if (!retrievedContent || retrievedContent.length === 0) {
      return 'No relevant uploaded study materials were found for this query.';
    }

    let context = 'Here is the relevant excerpt directly extracted from the student\'s uploaded study materials:\n\n';

    retrievedContent.forEach((content, idx) => {
      context += `==================================================\n`;
      context += `[SOURCE ${idx + 1}: "${content.title}"] (Type: ${content.type.toUpperCase()})\n`;
      if (content.topics && content.topics.length > 0) {
        context += `Topics: ${content.topics.join(', ')}\n`;
      }
      if (content.summaries?.brief) {
        context += `Summary Overview: ${content.summaries.brief}\n`;
      }
      context += `Relevant Material Excerpt:\n${content.text}\n`;
      context += `==================================================\n\n`;
    });

    return context;
  }

  /**
   * Generate suggested follow-up questions
   */
  generateSuggestedQuestions(userMessage, response, topics = []) {
    const suggestions = [];

    if (topics.length > 0) {
      suggestions.push(`Can you explain ${topics[0]} in more detail with an example?`);
    } else {
      suggestions.push('Can you provide a practical real-world example?');
    }

    if (topics.length > 1) {
      suggestions.push(`How does this compare to ${topics[1]}?`);
    } else {
      suggestions.push('What are the key exam takeaways from this topic?');
    }

    return suggestions.slice(0, 2);
  }

  /**
   * Extract topics from response
   */
  extractTopicsFromResponse(response) {
    const topics = [];
    const commonTopics = [
      'architecture', 'mechanism', 'algorithm', 'concurrency', 'normalization',
      'indexing', 'recovery', 'testing', 'security', 'optimization', 'definition'
    ];

    commonTopics.forEach(topic => {
      if (response && response.toLowerCase().includes(topic)) {
        topics.push(topic.charAt(0).toUpperCase() + topic.slice(1));
      }
    });

    return topics.slice(0, 3);
  }
}

export default new RAGService();
