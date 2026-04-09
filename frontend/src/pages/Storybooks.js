import { useEffect, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Storybooks() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/storybooks/')
      .then(({ data }) => setBooks(data.storybooks))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Storybooks</h1>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => toast('Feature coming soon!')}>
          <Plus size={16} /> Generate Storybook
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#555', textAlign: 'center', marginTop: 60 }}>Loading storybooks...</p>
      ) : books.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48 }}>📚</div>
          <p>No storybooks yet. Select stories and compile them into a beautiful narrative.</p>
        </div>
      ) : (
        books.map(book => (
          <div key={book.id} className="storybook-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BookOpen size={24} color="#a855f7" />
              <div style={{ flex: 1 }}>
                <h3>{book.title}</h3>
                <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{book.description || 'No description'}</p>
                <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
                  {book.story_ids.length} stories • Created {new Date(book.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
