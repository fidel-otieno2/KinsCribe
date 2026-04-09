import { useEffect, useState } from 'react';
import api from '../api/axios';
import StoryCard from '../components/StoryCard';
import CreateStoryModal from '../components/CreateStoryModal';
import { PlusCircle } from 'lucide-react';

export default function Feed() {
  const [stories, setStories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFeed = async () => {
    try {
      const { data } = await api.get('/stories/feed');
      setStories(data.stories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeed(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Family Feed</h1>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => setShowCreate(true)}>
          <PlusCircle size={16} /> New Story
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#555', textAlign: 'center', marginTop: 60 }}>Loading stories...</p>
      ) : stories.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>📖</div>
          <p>No stories yet. Be the first to share one!</p>
        </div>
      ) : (
        stories.map(story => (
          <StoryCard key={story.id} story={story} onUpdate={fetchFeed} />
        ))
      )}

      {showCreate && (
        <CreateStoryModal onClose={() => setShowCreate(false)} onCreated={fetchFeed} />
      )}
    </div>
  );
}
