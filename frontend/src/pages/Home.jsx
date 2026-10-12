import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Upload, Sparkles, Brain, BarChart3, Lightbulb, Target, Rocket, TrendingUp, Check
} from 'lucide-react';
import { Button } from '../components/Button';

export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Navbar */}
      <nav className="bg-white border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary">EduHub</div>
              <div className="text-xs text-text-secondary">Learn Better</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button onClick={() => navigate('/register')}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold text-text-primary mb-4 leading-tight">
              Study smarter with AI-powered learning
            </h1>
            <p className="text-lg text-text-secondary mb-8 leading-relaxed">
              Upload your materials, generate quizzes, and track progress with intelligent analytics. A focused learning tool for serious students.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/register')}>
                Get Started
              </Button>
              <Button variant="secondary" onClick={() => navigate('/login')}>
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-bg-primary border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-text-primary mb-12">Core Features</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Upload,
                title: 'Upload Materials',
                desc: 'PDF, Word, Text, or URLs. Supports all common formats.'
              },
              {
                icon: Sparkles,
                title: 'AI-Generated Quizzes',
                desc: 'Automatically create quizzes from your materials.'
              },
              {
                icon: Brain,
                title: 'Adaptive Learning',
                desc: 'Focus on weak areas with intelligent question selection.'
              },
              {
                icon: BarChart3,
                title: 'Track Progress',
                desc: 'Detailed analytics and performance insights.'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white border border-border rounded-lg p-6 hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-bg-primary rounded-lg">
                    <feature.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-2">{feature.title}</h3>
                    <p className="text-sm text-text-secondary">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-text-primary mb-12">How It Works</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Upload', desc: 'Share your study materials' },
              { step: '2', title: 'Analyze', desc: 'AI extracts key topics' },
              { step: '3', title: 'Quiz', desc: 'Answer AI questions' },
              { step: '4', title: 'Improve', desc: 'View analytics & progress' }
            ].map((item, idx) => (
              <div key={idx} className="bg-bg-primary border border-border rounded-lg p-6">
                <div className="text-2xl font-bold text-primary mb-3">{item.step}</div>
                <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
                <p className="text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="bg-bg-primary border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-text-primary mb-12">Built on Modern Tech</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Frontend', items: ['React 18', 'Tailwind CSS', 'Framer Motion', 'Recharts'] },
              { title: 'Backend', items: ['Node.js + Express', 'JWT Auth', 'Multer Upload', 'Gemini AI'] },
              { title: 'Database', items: ['MongoDB', 'User Management', 'Quiz Storage', 'Analytics'] }
            ].map((section, idx) => (
              <div key={idx} className="bg-white border border-border rounded-lg p-6">
                <h3 className="font-semibold text-text-primary mb-4">{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Check className="w-4 h-4 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-text-primary mb-12">Why EduHub?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Lightbulb, title: 'Smart Analysis', desc: 'AI automatically extracts key topics and concepts' },
              { icon: Target, title: 'Personalized Path', desc: 'Adaptive quizzes focus on your weak areas' },
              { icon: Rocket, title: 'Fast Generation', desc: 'Get AI-generated quizzes in seconds' },
              { icon: TrendingUp, title: 'Detailed Analytics', desc: 'Track progress and measure improvement' }
            ].map((item, idx) => (
              <div key={idx} className="bg-bg-primary border border-border rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-white rounded-lg">
                    <item.icon className="w-5 h-5 text-primary flex-shrink-0" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
                    <p className="text-sm text-text-secondary">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Join students mastering their subjects with EduHub's AI-powered learning
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={() => navigate('/register')} className="bg-black text-white">
              Get Started
            </Button>
            <Button variant="secondary" onClick={() => navigate('/login')} className="border-white text-black hover:bg-opacity-10">
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><a href="#" className="hover:text-primary">Features</a></li>
                <li><a href="#" className="hover:text-primary">Pricing</a></li>
                <li><a href="#" className="hover:text-primary">Security</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><a href="#" className="hover:text-primary">About</a></li>
                <li><a href="#" className="hover:text-primary">Blog</a></li>
                <li><a href="#" className="hover:text-primary">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><a href="#" className="hover:text-primary">Docs</a></li>
                <li><a href="#" className="hover:text-primary">API</a></li>
                <li><a href="#" className="hover:text-primary">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><a href="#" className="hover:text-primary">Privacy</a></li>
                <li><a href="#" className="hover:text-primary">Terms</a></li>
                <li><a href="#" className="hover:text-primary">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-text-secondary">
            <p>&copy; 2026 EduHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
