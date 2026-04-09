import { useEffect, useState } from 'react';
import api from '../api/axios';
import StoryCard from '../components/StoryCard';

export default function Timeline() {
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stories/timeline')
      .then(({ data }) => {
        const groups = {};
        data.stories.forEach(s => {
          const year = s.story_date ? new Date(s.story_date).getFullYear() : 'Unknown';
          if (!groups[year]) groups[year] = [];
          groups[year].push(s);
        });
        setGrouped(groups);
      })
      .finally(() => setLoading(false));
  }, []);

  const years = Object.keys(grouped).sort((a, b) => b - a);

  return (
    <div>
      <div className="page-header">
        <h1>Family Timeline</h1>
      </div>

      {loading ? (
        <p style={{ color: '#555', textAlign: 'center', marginTop: 60 }}>Loading timeline...</p>
      ) : years.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>🕰️</div>
          <p>No dated stories yet. Add a date when posting a story to see it here.</p>
        </div>
      ) : (
        <div className="timeline">
          {years.map(year => (
            <div key={year} className="timeline-item">
              <div className="timeline-dot" />
              <div className="timeline-year">{year}</div>
              {grouped[year].map(story => (
                <StoryCard key={story.id} story={story} onUpdate={() => {}} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
