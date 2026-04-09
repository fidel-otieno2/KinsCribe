import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import StoryCard from '../components/StoryCard';

export default function Profile() {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stories/feed')
      .then(({ data }) => setStories(data.stories.filter(s => s.user_id === user?.id)))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>
          {user?.avatar_url ? <img src={user.avatar_url} alt={user.name} /> : user?.name?.[0]}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{user?.email}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span className="ai-badge">{user?.role}</span>
            {user?.is_verified && <span className="ai-badge" style={{ background: '#0a2e1a', color: '#4ade80' }}>✓ Verified</span>}
          </div>
          {user?.bio && <p style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>{user.bio}</p>}
        </div>
      </div>

      <div className="page-header">
        <h1>My Stories</h1>
        <span style={{ color: '#666', fontSize: 14 }}>{stories.length} stories</span>
      </div>

      {loading ? (
        <p style={{ color: '#555', textAlign: 'center', marginTop: 40 }}>Loading...</p>
      ) : stories.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>✍️</div>
          <p>You haven't shared any stories yet.</p>
        </div>
      ) : (
        stories.map(story => <StoryCard key={story.id} story={story} onUpdate={() => {}} />)
      )}
    </div>
  );
}
