import axios from 'axios';
import { AppError } from '../middleware/errorHandler.js';

class ExternalResourceService {
  /**
   * Get learning resources for a topic from multiple sources
   */
  async getResourcesForTopic(topic) {
    try {
      console.log(`🔍 Fetching resources for topic: ${topic}`);

      const resources = {
        videos: [],
        articles: [],
        documents: [],
        courses: []
      };

      // Fetch from multiple sources in parallel
      const [videos, articles, courses] = await Promise.allSettled([
        this.fetchYouTubeVideos(topic),
        this.fetchArticles(topic),
        this.fetchCourses(topic)
      ]);

      if (videos.status === 'fulfilled') {
        resources.videos = videos.value;
      }
      if (articles.status === 'fulfilled') {
        resources.articles = articles.value;
      }
      if (courses.status === 'fulfilled') {
        resources.courses = courses.value;
      }

      console.log(`✅ Found ${resources.videos.length} videos, ${resources.articles.length} articles, ${resources.courses.length} courses`);

      return resources;
    } catch (error) {
      console.error('Error fetching resources:', error.message);
      return {
        videos: [],
        articles: [],
        documents: [],
        courses: []
      };
    }
  }

  /**
   * Fetch YouTube videos for a topic
   */
  async fetchYouTubeVideos(topic) {
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        return [{
          id: 'yt-search',
          title: `YouTube: "${topic}" Tutorials`,
          description: `Watch video lectures and tutorials on ${topic}`,
          thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&h=200&fit=crop',
          channel: 'YouTube Learning',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + ' tutorial')}`,
          type: 'video',
          platform: 'YouTube',
          duration: 'Video'
        }];
      }

      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          q: `${topic} tutorial educational`,
          part: 'snippet',
          type: 'video',
          maxResults: 5,
          order: 'relevance',
          key: apiKey,
          videoDuration: 'medium' // 4-20 minutes
        },
        timeout: 5000
      });

      return response.data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium.url,
        channel: item.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        type: 'video',
        platform: 'YouTube',
        duration: '4-20 min'
      }));
    } catch (error) {
      console.error('YouTube fetch error:', error.message);
      return [];
    }
  }

  /**
   * Fetch articles and documentation
   */
  async fetchArticles(topic) {
    try {
      // Use multiple sources for articles
      const articles = [];

      // 1. Wikipedia API (Requires User-Agent per Wikimedia policy)
      try {
        const wikiResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            list: 'search',
            srsearch: topic,
            format: 'json',
            srlimit: 3
          },
          headers: {
            'User-Agent': 'AIStudyCompanion/1.0 (academic-project@muj.edu)'
          },
          timeout: 5000
        });

        if (wikiResponse.data?.query?.search?.length > 0) {
          articles.push(...wikiResponse.data.query.search.map(item => ({
            title: item.title,
            description: item.snippet ? item.snippet.replace(/<[^>]*>/g, '') : '',
            url: `https://en.wikipedia.org/wiki/${item.title.replace(/ /g, '_')}`,
            type: 'article',
            platform: 'Wikipedia',
            source: 'Wikipedia'
          })));
        }
      } catch (error) {
        console.warn('Wikipedia fetch failed:', error.message);
      }

      // 2. Dev.to API (for tech topics)
      try {
        const devtoResponse = await axios.get('https://dev.to/api/articles', {
          params: {
            tag: topic.toLowerCase().replace(/ /g, '-'),
            per_page: 3
          },
          headers: {
            'User-Agent': 'AIStudyCompanion/1.0'
          },
          timeout: 5000
        });

        if (devtoResponse.data?.length > 0) {
          articles.push(...devtoResponse.data.map(item => ({
            title: item.title,
            description: item.description,
            url: item.url,
            type: 'article',
            platform: 'Dev.to',
            source: 'Dev.to',
            author: item.user?.name
          })));
        }
      } catch (error) {
        // Dev.to tag search may be empty for non-standard tags; silently ignore
      }

      // 3. Medium Search Link (Medium blocks automated scrapers with 403, so provide direct search link)
      articles.push({
        title: `Search "${topic}" on Medium`,
        description: 'Read articles and deep-dives from engineering and academic writers on Medium',
        url: `https://medium.com/search?q=${encodeURIComponent(topic)}`,
        type: 'article',
        platform: 'Medium',
        source: 'Medium'
      });

      return articles;
    } catch (error) {
      console.error('Articles fetch error:', error.message);
      return [];
    }
  }

  /**
   * Fetch online courses
   */
  async fetchCourses(topic) {
    try {
      const courses = [];

      // 1. Coursera (via search)
      courses.push({
        title: `Coursera: ${topic} Courses`,
        description: 'Find professional courses on Coursera',
        url: `https://www.coursera.org/search?query=${encodeURIComponent(topic)}`,
        type: 'course',
        platform: 'Coursera',
        source: 'Coursera',
        level: 'Beginner to Advanced'
      });

      // 2. Udemy (via search)
      courses.push({
        title: `Udemy: ${topic} Courses`,
        description: 'Find affordable courses on Udemy',
        url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(topic)}`,
        type: 'course',
        platform: 'Udemy',
        source: 'Udemy',
        level: 'All Levels'
      });

      // 3. Khan Academy (via search)
      courses.push({
        title: `Khan Academy: ${topic}`,
        description: 'Free educational videos and exercises',
        url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(topic)}`,
        type: 'course',
        platform: 'Khan Academy',
        source: 'Khan Academy',
        level: 'Free'
      });

      // 4. edX (via search)
      courses.push({
        title: `edX: ${topic} Courses`,
        description: 'University-level courses',
        url: `https://www.edx.org/search?q=${encodeURIComponent(topic)}`,
        type: 'course',
        platform: 'edX',
        source: 'edX',
        level: 'University Level'
      });

      return courses;
    } catch (error) {
      console.error('Courses fetch error:', error.message);
      return [];
    }
  }

  /**
   * Get curated resources for common topics
   */
  getCuratedResources(topic) {
    const curatedResources = {
      'Data Structures': {
        videos: [
          {
            title: 'Data Structures Fundamentals',
            url: 'https://www.youtube.com/watch?v=RBSGKlAvoiM',
            platform: 'YouTube',
            channel: 'freeCodeCamp'
          }
        ],
        articles: [
          {
            title: 'Data Structures Explained',
            url: 'https://www.geeksforgeeks.org/data-structures/',
            platform: 'GeeksforGeeks'
          }
        ],
        courses: [
          {
            title: 'Data Structures Course',
            url: 'https://www.coursera.org/learn/data-structures',
            platform: 'Coursera'
          }
        ]
      },
      'Algorithms': {
        videos: [
          {
            title: 'Algorithms Explained',
            url: 'https://www.youtube.com/watch?v=ZZuD6iUe3Pc',
            platform: 'YouTube',
            channel: 'freeCodeCamp'
          }
        ],
        articles: [
          {
            title: 'Algorithm Tutorials',
            url: 'https://www.geeksforgeeks.org/fundamentals-of-algorithms/',
            platform: 'GeeksforGeeks'
          }
        ],
        courses: [
          {
            title: 'Algorithms Specialization',
            url: 'https://www.coursera.org/specializations/algorithms',
            platform: 'Coursera'
          }
        ]
      },
      'Machine Learning': {
        videos: [
          {
            title: 'Machine Learning Course',
            url: 'https://www.youtube.com/watch?v=PeMlggyqfqo',
            platform: 'YouTube',
            channel: 'freeCodeCamp'
          }
        ],
        articles: [
          {
            title: 'ML Tutorials',
            url: 'https://www.geeksforgeeks.org/machine-learning/',
            platform: 'GeeksforGeeks'
          }
        ],
        courses: [
          {
            title: 'Machine Learning Specialization',
            url: 'https://www.coursera.org/specializations/machine-learning-introduction',
            platform: 'Coursera'
          }
        ]
      }
    };

    return curatedResources[topic] || null;
  }
}

export default new ExternalResourceService();
