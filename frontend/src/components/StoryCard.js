import { Heart, MessageCircle, Share2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function StoryCard({ story, onUpdate }) {
  const [liked, setLiked] = useState(false);

  const handleLike = async () => {
    try {
      const { data } = await api.post(`/stories/${story.id}/like`);
      setLiked(data.liked);
      onUpdate();
    } catch (err) {
      toast.error('Failed to like');
    }
  };

  return (
    <div className="story-card">
      <div className="story-card-header">
        <div className="avatar">{story.author_name?.[0] || 'U'}</div>
        <div className="user-info">
          <div className="name">{story.author_name || 'Unknown'}</div>
          <div className="date">{new Date(story.created_at).toLocaleDateString()}</div>
        </div>
        <span className={`privacy-badge ${story.privacy}`}>{story.privacy}</span>
      </div>

      {story.media_url && (
        <div className="story-media">
          {story.media_type === 'video' && <video src={story.media_url} controls />}
          {story.media_type === 'audio' && <audio src={story.media_url} controls />}
          {story.media_type === 'image' && <img src={story.media_url} alt={story.title} />}
        </div>
      )}

      <div className="story-card-body">
        <div className="story-title">{story.title}</div>
        {story.content && <div className="story-content">{story.content}</div>}
        {story.transcript && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#999', borderLeft: '2px solid #333', paddingLeft: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Sparkles size={12} />
              <span style={{ fontSize: 11, fontWeight: 600 }}>Transcript</span>
            </div>
            {story.transcript}
          </div>
        )}
        {story.summary && (
          <div className="story-summary">
            <strong>Summary:</strong> {story.summary}
          </div>
        )}
        {story.tags?.length > 0 && (
          <div className="story-tags">
            {story.tags.map((tag, i) => (
              <span key={i} className="tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="story-actions">
        <button className={`action-btn${liked ? ' liked' : ''}`} onClick={handleLike}>
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          {story.like_count || 0}
        </button>
        <button className="action-btn">
          <MessageCircle size={18} />
          {story.comment_count || 0}
        </button>
        <button className="action-btn">
          <Share2 size={18} />
        </button>
      </div>
    </div>
  );
}
