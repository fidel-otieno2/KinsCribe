import { useEffect, useState } from 'react';
import { Mail, Crown, Shield } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const roleIcon = { admin: Crown, historian: Shield };

export default function FamilyMembers() {
  const { user } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/family/my-family')
      .then(({ data }) => { setFamily(data.family); setMembers(data.members); })
      .finally(() => setLoading(false));
  }, []);

  const sendInvite = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/family/invite/email', { email: inviteEmail });
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p style={{ color: '#555', textAlign: 'center', marginTop: 60 }}>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>{family?.name}</h1>
        <span className="ai-badge">👨‍👩‍👧 {members.length} members</span>
      </div>

      {family?.description && (
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>{family.description}</p>
      )}

      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Invite Code</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, color: '#a855f7' }}>{family?.invite_code}</div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Share this code with family members to join</div>
      </div>

      {user?.role === 'admin' && (
        <form onSubmit={sendInvite} style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <input type="email" placeholder="Invite by email..." value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)} required />
          </div>
          <button className="btn-primary" type="submit" disabled={sending}
            style={{ width: 'auto', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={14} /> {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {members.map(m => {
          const RoleIcon = roleIcon[m.role];
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 14 }}>
              <div className="avatar">{m.avatar_url ? <img src={m.avatar_url} alt={m.name} /> : m.name?.[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{m.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888' }}>
                {RoleIcon && <RoleIcon size={14} color="#a855f7" />}
                {m.role}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
