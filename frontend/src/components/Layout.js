import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Clock, BookOpen, Users, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/timeline', icon: Clock, label: 'Timeline' },
  { to: '/storybooks', icon: BookOpen, label: 'Storybooks' },
  { to: '/family', icon: Users, label: 'Family' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">KinsCribe</div>
        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user.name} />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{user?.role}</div>
          </div>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
