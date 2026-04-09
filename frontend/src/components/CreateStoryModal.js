import { useState } from 'react';
import { X, Upload, Mic, Video, FileText } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const TYPES = [
  { key: 'text', icon: FileText, label: 'Write Story' },
  { key: 'audio', icon: Mic, label: 'Audio Story' },
  { key: 'video', icon: Video, label: 'Video Story' },
];

export default function CreateStoryModal({ onClose, onCreated }) {
  const [type, setType] = useState('text');
  const [form, setForm] = useState({ title: '', content: '', privacy: 'family', story_date: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title) return toast.error('Title is required');
    setLoading(true);

    try {
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
        await api.post('/stories/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/stories/', { ...form, media_type: 'text' });
      }
      toast.success('Story posted! AI is processing it...');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to post story');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Share a Story</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {TYPES.map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setType(key)}
              className={type === key ? 'btn-primary' : 'btn-secondary'}
              style={{ flex: 1, padding: '10px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input type="text" placeholder="Give your story a title..." value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>

          {type === 'text' && (
            <div className="form-group">
              <label>Story</label>
              <textarea rows={5} placeholder="Write your story here..." value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })} />
            </div>
          )}

          {(type === 'audio' || type === 'video') && (
            <div className="upload-zone" onClick={() => document.getElementById('file-input').click()}>
              <Upload size={28} color="#555" />
              <p>{file ? file.name : `Click to upload ${type} file`}</p>
              <input id="file-input" type="file"
                accept={type === 'audio' ? 'audio/*' : 'video/*'}
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files[0])} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>When did this happen?</label>
              <input type="date" value={form.story_date}
                onChange={e => setForm({ ...form, story_date: e.target.value })} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Privacy</label>
              <select value={form.privacy} onChange={e => setForm({ ...form, privacy: e.target.value })}>
                <option value="family">Family Only</option>
                <option value="private">Private</option>
                <option value="public">Public Legacy</option>
              </select>
            </div>
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Posting...' : 'Post Story'}
          </button>
        </form>
      </div>
    </div>
  );
}
