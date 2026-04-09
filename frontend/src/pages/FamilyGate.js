import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function FamilyGate() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState(null); // 'create' | 'join'
  const [loading, setLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [inviteCode, setInviteCode] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/family/create', createForm);
      await refreshUser();
      toast.success('Family created!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create family');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/family/join', { invite_code: inviteCode });
      await refreshUser();
      toast.success(`Joined ${data.family.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gate-page">
      <div className="gate-card">
        {!view ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
            <h2>Welcome, {user?.name?.split(' ')[0]}!</h2>
            <p>To use KinsCribe, you must belong to a family group. Create one or join with an invite code.</p>
            <div className="gate-options">
              <div className="gate-option" onClick={() => setView('create')}>
                <h3>✨ Create a Family</h3>
                <p>Start a new family group and invite members</p>
              </div>
              <div className="gate-option" onClick={() => setView('join')}>
                <h3>🔑 Join with Invite Code</h3>
                <p>Enter a code sent by your family admin</p>
              </div>
            </div>
          </>
        ) : view === 'create' ? (
          <>
            <h2 style={{ marginBottom: 24 }}>Create Your Family</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Family Name</label>
                <input type="text" placeholder="e.g. The Otieno Family" value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <input type="text" placeholder="A brief description..." value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })} />
              </div>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Family'}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setView(null)}
                style={{ marginTop: 12, display: 'block', width: '100%', textAlign: 'center' }}>
                ← Back
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 24 }}>Join a Family</h2>
            <form onSubmit={handleJoin}>
              <div className="form-group">
                <label>Invite Code</label>
                <input type="text" placeholder="e.g. AB12CD34" value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())} required
                  style={{ letterSpacing: 4, textAlign: 'center', fontSize: 18 }} />
              </div>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Joining...' : 'Join Family'}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setView(null)}
                style={{ marginTop: 12, display: 'block', width: '100%', textAlign: 'center' }}>
                ← Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
