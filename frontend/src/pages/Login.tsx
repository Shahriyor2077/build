import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../store/auth';

const DEMO = [
  ['Super Admin', 'admin@realitycrm.com'],
  ['CRM Admin', 'crmadmin@realitycrm.com'],
  ['Sales Agent', 'agent@realitycrm.com'],
  ['Channel Partner', 'broker@realitycrm.com'],
  ['Project Manager', 'pm@realitycrm.com'],
  ['Finance', 'finance@realitycrm.com'],
];

export default function Login() {
  const [email, setEmail] = useState('admin@realitycrm.com');
  const [password, setPassword] = useState('Passw0rd!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setTokens, setUser } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken);
      const me = await api.get('/auth/me');
      setUser(me.data);
      navigate('/');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 to-indigo-800 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-surface shadow-2xl md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-brand-700 p-10 text-white md:flex">
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-surface/20 text-2xl font-bold">R</div>
            <h1 className="text-2xl font-bold">Reality CRM</h1>
            <p className="mt-2 text-brand-100">Campaign to booking — the complete real estate sales lifecycle.</p>
          </div>
          <div className="space-y-2 text-sm text-brand-100">
            <p className="font-semibold text-white">Demo accounts (password: Passw0rd!)</p>
            {DEMO.map(([role, mail]) => (
              <button
                key={mail}
                onClick={() => setEmail(mail)}
                className="block w-full rounded-lg bg-surface/10 px-3 py-1.5 text-left text-xs hover:bg-surface/20"
              >
                <b>{role}</b> — {mail}
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-col justify-center p-10">
          <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Access your CRM workspace</p>
          {error && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
          <div className="mt-6 space-y-4">
            <div>
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <span className="label">Password</span>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
