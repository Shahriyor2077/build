import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
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

// Site-plan signature: a tower x floor grid with one unit pinned as the
// "you are here" — the same coordinate idea the Inventory floor grid uses,
// repurposed as the login's visual identity instead of a generic hero.
const PLOT = { x0: 36, x1: 350, y0: 18, y1: 146 };
const ROWS = ['A', 'B', 'C', 'D'];
const COLS = 12;
const colW = (PLOT.x1 - PLOT.x0) / COLS;
const rowH = (PLOT.y1 - PLOT.y0) / ROWS.length;
const HILITE = { row: 1, col: 8 }; // Tower B, floor 9
const FILL_BOX = { transformBox: 'fill-box', transformOrigin: 'center' } as const;
const MONO = "'IBM Plex Mono', monospace";

function SitePlan() {
  const cx = PLOT.x0 + colW * (HILITE.col + 0.5);
  const cy = PLOT.y0 + rowH * (HILITE.row + 0.5);
  return (
    <svg
      viewBox="0 0 360 230"
      className="w-full"
      role="img"
      aria-label="Floor plan grid for Tower B, floor 9, with unit 904 marked reserved"
    >
      {Array.from({ length: ROWS.length + 1 }).map((_, i) => (
        <line
          key={`h-${i}`}
          pathLength={1}
          x1={PLOT.x0}
          y1={PLOT.y0 + i * rowH}
          x2={PLOT.x1}
          y2={PLOT.y0 + i * rowH}
          stroke="#fff"
          strokeOpacity={0.14}
          className="anim-grid-line"
          style={{ animationDelay: `${0.05 * i}s` }}
        />
      ))}
      {Array.from({ length: COLS + 1 }).map((_, i) => (
        <line
          key={`v-${i}`}
          pathLength={1}
          x1={PLOT.x0 + i * colW}
          y1={PLOT.y0}
          x2={PLOT.x0 + i * colW}
          y2={PLOT.y1}
          stroke="#fff"
          strokeOpacity={0.14}
          className="anim-grid-line"
          style={{ animationDelay: `${0.03 * i}s` }}
        />
      ))}

      {ROWS.map((label, i) => (
        <text
          key={label}
          x={PLOT.x0 - 8}
          y={PLOT.y0 + rowH * (i + 0.5) + 3}
          textAnchor="end"
          fontFamily={MONO}
          fontSize={9}
          fill="#fff"
          fillOpacity={i === HILITE.row ? 0.9 : 0.32}
        >
          {label}
        </text>
      ))}
      {Array.from({ length: COLS }).map((_, i) => (
        <text
          key={`cl-${i}`}
          x={PLOT.x0 + colW * (i + 0.5)}
          y={PLOT.y1 + 13}
          textAnchor="middle"
          fontFamily={MONO}
          fontSize={7}
          fill="#fff"
          fillOpacity={i === HILITE.col ? 0.9 : 0.28}
        >
          {i + 1}
        </text>
      ))}

      <rect
        x={PLOT.x0 + colW * HILITE.col}
        y={PLOT.y0 + rowH * HILITE.row}
        width={colW}
        height={rowH}
        rx={2}
        fillOpacity={0.22}
        strokeOpacity={0.9}
        strokeWidth={1.25}
        className="fill-brand-500 stroke-brand-500 anim-pin"
        style={FILL_BOX}
      />
      <circle cx={cx} cy={cy} r={10} className="fill-brand-500 anim-pin-halo" style={FILL_BOX} />
      <circle cx={cx} cy={cy} r={4.5} fill="#fff" strokeWidth={2} className="stroke-brand-600 anim-pin" style={FILL_BOX} />

      <line
        pathLength={1}
        x1={cx}
        y1={cy + 9}
        x2={cx}
        y2={200}
        stroke="#fff"
        strokeOpacity={0.25}
        className="anim-grid-line"
        style={{ animationDelay: '0.6s' }}
      />
      <line
        pathLength={1}
        x1={PLOT.x0}
        y1={205}
        x2={PLOT.x1}
        y2={205}
        stroke="#fff"
        strokeOpacity={0.15}
        className="anim-grid-line"
        style={{ animationDelay: '0.65s' }}
      />

      <text x={PLOT.x0} y={222} fontFamily={MONO} fontSize={10} letterSpacing="0.06em" fill="#fff" fillOpacity={0.85} className="anim-caption">
        TOWER B · FLOOR 09 · UNIT 904
      </text>
      <text
        x={PLOT.x1}
        y={222}
        textAnchor="end"
        fontFamily={MONO}
        fontSize={10}
        letterSpacing="0.08em"
        className="fill-brand-500 anim-caption"
      >
        RESERVED
      </text>
    </svg>
  );
}

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
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 sm:p-6">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-2xl md:grid-cols-[1.1fr_1fr]">
        <div className="relative flex flex-col justify-between gap-7 overflow-hidden bg-blueprint-900 p-8 text-white sm:p-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            aria-hidden
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-display text-base font-semibold">R</div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">Reality CRM</span>
            </div>
            <h1 className="font-display text-3xl font-medium leading-tight sm:text-[2.1rem]">
              Every booking starts
              <br />
              on this floor plan.
            </h1>
            <p className="mt-3 max-w-xs text-sm text-white/60">
              Campaigns, leads, site visits and bookings — tracked unit by unit, across every tower.
            </p>
          </div>

          <div className="relative hidden sm:block">
            <SitePlan />
          </div>

          <div className="relative">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Demo workspace · pass Passw0rd!</p>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO.map(([role, mail]) => (
                <button
                  key={mail}
                  type="button"
                  onClick={() => setEmail(mail)}
                  className={`rounded-lg border px-2.5 py-1.5 text-left transition ${
                    email === mail
                      ? 'border-brand-500/60 bg-brand-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="text-xs font-medium text-white/90">{role}</div>
                  <div className="truncate font-mono text-[10px] text-white/45">{mail}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col justify-center p-8 sm:p-10">
          <h2 className="font-display text-2xl font-medium text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Enter your details to access your workspace.</p>
          {error && (
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
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
              {loading ? (
                'Signing in…'
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
