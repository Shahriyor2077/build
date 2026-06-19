import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, SlidersHorizontal, CreditCard, Mail, ScrollText, Plus, Trash2, KeyRound, Database, Pencil,
  GripVertical, ArrowUp, ArrowDown,
} from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { PageHeader, Card, StatusBadge, Spinner, EmptyState, Field, Modal } from '../components/ui';
import { DataTable, Column } from '../components/DataTable';
import { useAuth } from '../store/auth';
import {
  CustomFieldDef, CustomObjectType, OBJECT_LABELS, FIELD_TYPE_META, fieldTypeLabel, useCustomFieldDefs,
} from '../components/customFields';

// ── Tabs ────────────────────────────────────────────────────────────────────

type TabKey = 'users' | 'config' | 'fields' | 'plans' | 'templates' | 'audit';

interface TabDef {
  key: TabKey;
  label: string;
  icon: typeof Users;
  perm?: string;
}

const TABS: TabDef[] = [
  { key: 'users', label: 'Users & Roles', icon: Users, perm: 'admin.users' },
  { key: 'config', label: 'System Config', icon: SlidersHorizontal, perm: 'admin.config' },
  { key: 'fields', label: 'Object Manager', icon: Database, perm: 'admin.config' },
  { key: 'plans', label: 'Payment Plans', icon: CreditCard },
  { key: 'templates', label: 'Notification Templates', icon: Mail, perm: 'admin.templates' },
  { key: 'audit', label: 'Audit Log', icon: ScrollText, perm: 'admin.audit' },
];

export default function Settings() {
  const { can } = useAuth();
  const visible = TABS.filter((t) => !t.perm || can(t.perm));
  const [active, setActive] = useState<TabKey>(visible[0]?.key ?? 'plans');

  return (
    <div>
      <PageHeader title="Settings" subtitle="Administer users, configuration and templates" />

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {visible.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {active === 'users' && <UsersRolesTab />}
      {active === 'config' && <SystemConfigTab />}
      {active === 'fields' && <ObjectManagerTab />}
      {active === 'plans' && <PaymentPlansTab />}
      {active === 'templates' && <TemplatesTab />}
      {active === 'audit' && <AuditLogTab />}
    </div>
  );
}

// ── Users & Roles ──────────────────────────────────────────────────────────────

function UsersRolesTab() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [resetFor, setResetFor] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);

  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = (await api.get('/admin/users')).data;
      return (Array.isArray(res) ? res : res?.data ?? []) as any[];
    },
  });

  const roles = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const res = (await api.get('/admin/roles')).data;
      return (Array.isArray(res) ? res : res?.data ?? []) as any[];
    },
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/users/${id}/deactivate`, {})).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const columns: Column<any>[] = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (r) => String(r.role ?? r.roleName ?? r.roleLabel ?? '—').replace(/_/g, ' ') },
    { key: 'isActive', header: 'Status', render: (r) => <StatusBadge status={r.isActive === false ? 'PAUSED' : 'ACTIVE'} /> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <div className="flex justify-end gap-2">
          <button className="btn-ghost !py-1 text-xs" onClick={() => setResetFor(r)}>
            <KeyRound size={14} /> Reset
          </button>
          {r.isActive !== false && (
            <button
              className="btn-ghost !py-1 text-xs text-rose-600"
              disabled={deactivate.isPending}
              onClick={() => deactivate.mutate(r.id)}
            >
              Deactivate
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Users</h3>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add User
          </button>
        </div>
        <DataTable columns={columns} rows={users.data} loading={users.isLoading} emptyTitle="No users" />
      </section>

      <section>
        <h3 className="mb-3 font-semibold text-slate-800">Roles</h3>
        {roles.isLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(roles.data ?? []).map((role: any) => (
              <button
                key={role.id}
                onClick={() => can('admin.roles') && setSelectedRole(role)}
                className="card p-4 text-left transition hover:shadow"
              >
                <div className="font-medium text-slate-900">{role.label ?? role.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {(role.permissionKeys ?? role.permissions ?? []).length} permissions
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {showAdd && (
        <AddUserModal
          roles={roles.data ?? []}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); queryClient.invalidateQueries({ queryKey: ['admin-users'] }); }}
        />
      )}
      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />}
      {selectedRole && (
        <RolePermissionsModal
          role={selectedRole}
          onClose={() => setSelectedRole(null)}
          onSaved={() => { setSelectedRole(null); queryClient.invalidateQueries({ queryKey: ['admin-roles'] }); }}
        />
      )}
    </div>
  );
}

function AddUserModal({ roles, onClose, onSaved }: { roles: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', roleName: '' });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: async () =>
      (await api.post('/admin/users', {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        roleName: form.roleName,
      })).data,
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Add User"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!form.name || !form.email || !form.password || !form.roleName || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Saving…' : 'Add User'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Role">
          <select className="input" value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}>
            <option value="">Select a role…</option>
            {roles.map((r: any) => (
              <option key={r.id ?? r.name} value={r.name}>{r.label ?? r.name}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const mut = useMutation({
    mutationFn: async () => (await api.post(`/admin/users/${user.id}/reset-password`, { password })).data,
    onSuccess: () => setDone(true),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password — ${user.name}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" disabled={password.length < 6 || mut.isPending || done} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Reset Password'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        {done && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password updated.</div>}
        <Field label="New password">
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function RolePermissionsModal({ role, onClose, onSaved }: { role: any; onClose: () => void; onSaved: () => void }) {
  const [selected, setSelected] = useState<string[]>(role.permissionKeys ?? role.permissions ?? []);
  const [error, setError] = useState('');

  const perms = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: async () => {
      const res = (await api.get('/admin/permissions')).data;
      return (Array.isArray(res) ? res : res?.data ?? []) as any[];
    },
  });

  const mut = useMutation({
    mutationFn: async () => (await api.put(`/admin/roles/${role.id}/permissions`, { permissionKeys: selected })).data,
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const list: any[] = perms.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Permissions — ${role.label ?? role.name}`}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        {perms.isLoading ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {list.map((p: any) => {
              const key = typeof p === 'string' ? p : p.key;
              const label = typeof p === 'string' ? p : p.label ?? p.key;
              return (
                <label key={key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} className="accent-brand-600" />
                  <span className="text-slate-700">{label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── System Config ────────────────────────────────────────────────────────────

const CONFIG_KEYS: { key: string; label: string; type: 'number' | 'json' | 'text' }[] = [
  { key: 'holdHours', label: 'Hold Hours', type: 'number' },
  { key: 'gstRates', label: 'GST Rates', type: 'json' },
  { key: 'discountThresholds', label: 'Discount Thresholds', type: 'json' },
  { key: 'targets', label: 'Targets', type: 'json' },
  { key: 'branding.companyName', label: 'Company Name', type: 'text' },
];

function getNested(obj: any, path: string): any {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function SystemConfigTab() {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ['admin-config'],
    queryFn: async () => (await api.get('/admin/config')).data as Record<string, any>,
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {config.isLoading ? (
        <Spinner />
      ) : (
        CONFIG_KEYS.map((def) => (
          <ConfigField
            key={def.key}
            def={def}
            current={getNested(config.data, def.key)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-config'] })}
          />
        ))
      )}
    </div>
  );
}

function ConfigField({
  def, current, onSaved,
}: {
  def: { key: string; label: string; type: 'number' | 'json' | 'text' };
  current: any;
  onSaved: () => void;
}) {
  const initial = useMemo(() => {
    if (current == null) return '';
    return def.type === 'json' ? JSON.stringify(current, null, 2) : String(current);
  }, [current, def.type]);

  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setValue(initial); }, [initial]);

  const mut = useMutation({
    mutationFn: async () => {
      let parsed: any = value;
      if (def.type === 'number') parsed = Number(value);
      else if (def.type === 'json') parsed = JSON.parse(value);
      return (await api.put('/admin/config', { key: def.key, value: parsed })).data;
    },
    onSuccess: () => { setSaved(true); setError(''); onSaved(); },
    onError: (e) => setError(e instanceof SyntaxError ? 'Invalid JSON' : apiErrorMessage(e)),
  });

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="label !mb-0">{def.label}</span>
        <code className="text-xs text-slate-400">{def.key}</code>
      </div>
      {def.type === 'json' ? (
        <textarea className="input min-h-[120px] font-mono text-xs" value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} />
      ) : (
        <input
          className="input"
          type={def.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
        />
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
        <button className="btn-outline" disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Card>
  );
}

// ── Payment Plans ─────────────────────────────────────────────────────────────

const PLAN_KINDS = ['CONSTRUCTION_LINKED', 'TIME_LINKED', 'CUSTOM'] as const;

function PaymentPlansTab() {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const plans = useQuery({
    queryKey: ['payment-plans'],
    queryFn: async () => {
      const res = (await api.get('/payment-plans')).data;
      return (Array.isArray(res) ? res : res?.data ?? []) as any[];
    },
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Payment Plans</h3>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> New Plan
        </button>
      </div>

      {plans.isLoading ? (
        <Spinner />
      ) : (plans.data ?? []).length === 0 ? (
        <EmptyState title="No payment plans" hint="Create a plan with milestones summing to 100%." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(plans.data ?? []).map((p: any) => (
            <Card key={p.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{p.name}</span>
                <StatusBadge status={p.kind} />
              </div>
              <ul className="space-y-1 text-sm text-slate-600">
                {(p.milestones ?? []).map((m: any, i: number) => (
                  <li key={i} className="flex justify-between">
                    <span>{m.label}</span>
                    <span className="font-medium text-slate-800">{m.percent}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <NewPlanModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); queryClient.invalidateQueries({ queryKey: ['payment-plans'] }); }} />
      )}
    </div>
  );
}

function NewPlanModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof PLAN_KINDS)[number]>('CONSTRUCTION_LINKED');
  const [milestones, setMilestones] = useState<{ label: string; percent: string }[]>([{ label: '', percent: '' }]);
  const [error, setError] = useState('');

  const total = milestones.reduce((sum, m) => sum + (Number(m.percent) || 0), 0);
  const validTotal = Math.abs(total - 100) < 0.01;

  const mut = useMutation({
    mutationFn: async () =>
      (await api.post('/payment-plans', {
        name,
        kind,
        milestones: milestones
          .filter((m) => m.label.trim())
          .map((m) => ({ label: m.label.trim(), percent: Number(m.percent) || 0 })),
      })).data,
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="New Payment Plan"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name.trim() || !validTotal || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Create Plan'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Kind">
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as any)}>
              {PLAN_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label !mb-0">Milestones</span>
            <button className="btn-ghost !py-1 text-xs" onClick={() => setMilestones([...milestones, { label: '', percent: '' }])}>
              <Plus size={14} /> Add milestone
            </button>
          </div>
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input"
                  placeholder="Label, e.g. On booking"
                  value={m.label}
                  onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  className="input !w-24"
                  type="number"
                  placeholder="%"
                  value={m.percent}
                  onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))}
                />
                <button className="btn-ghost !px-2" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className={`mt-2 text-sm font-medium ${validTotal ? 'text-emerald-600' : 'text-rose-600'}`}>
            Total: {total}% {validTotal ? '✓' : '(must sum to 100%)'}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Notification Templates ──────────────────────────────────────────────────────

const CHANNELS = ['EMAIL', 'SMS'] as const;

function TemplatesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any | null | undefined>(undefined); // undefined = closed, null = new

  const templates = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const res = (await api.get('/admin/templates')).data;
      return (Array.isArray(res) ? res : res?.data ?? []) as any[];
    },
  });

  const columns: Column<any>[] = [
    { key: 'key', header: 'Key', render: (r) => <span className="font-medium text-slate-900">{r.key}</span> },
    { key: 'channel', header: 'Channel', render: (r) => <StatusBadge status={r.channel} /> },
    { key: 'subject', header: 'Subject', render: (r) => r.subject ?? '—' },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Notification Templates</h3>
        <button className="btn-primary" onClick={() => setEditing(null)}>
          <Plus size={16} /> New Template
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={templates.data}
        loading={templates.isLoading}
        onRowClick={(r) => setEditing(r)}
        emptyTitle="No templates"
        emptyHint="Create an email or SMS template with Handlebars variables."
      />

      {editing !== undefined && (
        <TemplateModal
          template={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); queryClient.invalidateQueries({ queryKey: ['admin-templates'] }); }}
        />
      )}
    </div>
  );
}

function TemplateModal({ template, onClose, onSaved }: { template: any | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    key: template?.key ?? '',
    channel: (template?.channel ?? 'EMAIL') as (typeof CHANNELS)[number],
    subject: template?.subject ?? '',
    body: template?.body ?? '',
  });
  const [error, setError] = useState('');

  const mut = useMutation({
    mutationFn: async () =>
      (await api.post('/admin/templates', {
        key: form.key,
        channel: form.channel,
        subject: form.subject || undefined,
        body: form.body,
      })).data,
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={template ? 'Edit Template' : 'New Template'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!form.key.trim() || !form.body.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Save Template'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key">
            <input className="input" value={form.key} disabled={!!template} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g. booking_confirmed" />
          </Field>
          <Field label="Channel">
            <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as any })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Subject">
          <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </Field>
        <Field label="Body (Handlebars — use {{variable}})">
          <textarea className="input min-h-[140px] font-mono text-xs" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={'Hi {{name}}, your booking {{bookingNo}} is confirmed.'} />
        </Field>
      </div>
    </Modal>
  );
}

// ── Object Manager (custom fields) ────────────────────────────────────────────

const CUSTOM_OBJECTS: CustomObjectType[] = ['ACCOUNT', 'OPPORTUNITY', 'LEAD', 'SITE_VISIT'];

function ObjectManagerTab() {
  const queryClient = useQueryClient();
  const [object, setObject] = useState<CustomObjectType>('LEAD');
  const [editing, setEditing] = useState<CustomFieldDef | null | undefined>(undefined); // undefined=closed, null=new

  const defs = useCustomFieldDefs(object, { all: true });

  // Local ordering so reordering feels instant; synced whenever the query data
  // changes (object switch, create, edit, delete).
  const [items, setItems] = useState<CustomFieldDef[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  useEffect(() => { setItems(defs.data ?? []); }, [defs.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['custom-field-defs', object] });
    queryClient.invalidateQueries({ queryKey: ['custom-field-defs'] });
  };

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/custom-fields/definitions/${id}`)).data,
    onSuccess: invalidate,
  });

  const reorderMut = useMutation({
    mutationFn: async (ordered: CustomFieldDef[]) =>
      (await api.put('/custom-fields/definitions/reorder', { objectType: object, ids: ordered.map((f) => f.id) })).data,
    onError: () => invalidate(), // resync from server if the save failed
  });

  function commitOrder(next: CustomFieldDef[]) {
    setItems(next);
    reorderMut.mutate(next);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    commitOrder(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-300 bg-surface p-0.5">
          {CUSTOM_OBJECTS.map((o) => (
            <button
              key={o}
              onClick={() => setObject(o)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${object === o ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {OBJECT_LABELS[o]}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setEditing(null)}>
          <Plus size={16} /> New Field
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Drag the <GripVertical size={13} className="inline -mt-0.5 text-slate-400" /> handle (or use the arrows) to set the
        display order. Fields appear in this order on the create form and detail drawer of every {OBJECT_LABELS[object]} record.
      </p>

      {defs.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState title="No custom fields yet" hint={`Click "New Field" to add a custom field to ${OBJECT_LABELS[object]}.`} />
      ) : (
        <div className="space-y-2">
          {items.map((f, i) => (
            <div
              key={f.id}
              draggable
              onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.id); }}
              onDragOver={(e) => { if (dragIdx !== null) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
              onDrop={() => { if (dragIdx !== null) { move(dragIdx, i); setDragIdx(null); } }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-3 rounded-lg border border-slate-200 bg-surface px-3 py-2.5 shadow-sm transition ${dragIdx === i ? 'opacity-40' : ''}`}
            >
              <GripVertical size={16} className="shrink-0 cursor-grab text-slate-400 active:cursor-grabbing" />
              <span className="w-6 shrink-0 text-center text-xs font-medium text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-slate-900">{f.label}</span>
                  {f.required && <span className="text-rose-500">*</span>}
                  {!f.active && <StatusBadge status="ARCHIVED" />}
                </div>
                <div className="text-xs text-slate-500">
                  <code>{f.apiName}</code> · {fieldTypeLabel(f.fieldType)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button className="btn-ghost !px-1.5" title="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  <ArrowUp size={15} />
                </button>
                <button className="btn-ghost !px-1.5" title="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                  <ArrowDown size={15} />
                </button>
                <button className="btn-ghost !py-1 text-xs" onClick={() => setEditing(f)}>
                  <Pencil size={14} /> Edit
                </button>
                <button
                  className="btn-ghost !py-1 text-xs text-rose-600"
                  disabled={del.isPending}
                  onClick={() => { if (confirm(`Delete field "${f.label}"? Its stored values will be removed.`)) del.mutate(f.id); }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <FieldModal
          objectType={object}
          field={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); invalidate(); }}
        />
      )}
    </div>
  );
}

function FieldModal({
  objectType, field, onClose, onSaved,
}: { objectType: CustomObjectType; field: CustomFieldDef | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!field;
  const [fieldType, setFieldType] = useState<string>(field?.fieldType ?? '');
  const [label, setLabel] = useState(field?.label ?? '');
  const [required, setRequired] = useState(field?.required ?? false);
  const [active, setActive] = useState(field?.active ?? true);
  const [helpText, setHelpText] = useState(field?.helpText ?? '');
  const [optionsText, setOptionsText] = useState((field?.options ?? []).join('\n'));
  const [error, setError] = useState('');

  const options = optionsText.split('\n').map((s) => s.trim()).filter(Boolean);

  const mut = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return (await api.patch(`/custom-fields/definitions/${field!.id}`, {
          label,
          required,
          active,
          helpText: helpText || null,
          ...(fieldType === 'PICKLIST' ? { options } : {}),
        })).data;
      }
      return (await api.post('/custom-fields/definitions', {
        objectType,
        label,
        fieldType,
        required,
        helpText: helpText || undefined,
        ...(fieldType === 'PICKLIST' ? { options } : {}),
      })).data;
    },
    onSuccess: onSaved,
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const canSave = !!fieldType && !!label.trim() && (fieldType !== 'PICKLIST' || options.length > 0) && !mut.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit field — ${field!.label}` : 'New Custom Field'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!canSave} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create Field'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div>}

        {/* Data type picker — disabled when editing (type is immutable). */}
        {!isEdit && (
          <div>
            <span className="label">Data Type</span>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {FIELD_TYPE_META.map((m) => (
                <label key={m.type} className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="fieldType"
                    className="mt-1 accent-brand-600"
                    checked={fieldType === m.type}
                    onChange={() => setFieldType(m.type)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{m.label}</span>
                    <span className="block text-xs text-slate-500">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {isEdit && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Data type: <span className="font-medium text-slate-800">{fieldTypeLabel(fieldType)}</span>
            <span className="text-slate-400"> · {field!.apiName}</span>
          </div>
        )}

        {fieldType && (
          <>
            <Field label="Field Label">
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Lead Source Detail" />
            </Field>

            {fieldType === 'PICKLIST' && (
              <Field label="Picklist values (one per line)">
                <textarea
                  className="input min-h-[100px] font-mono text-xs"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={'Hoarding\nNewspaper\nReferral'}
                />
              </Field>
            )}

            <Field label="Help text (optional)">
              <input className="input" value={helpText} onChange={(e) => setHelpText(e.target.value)} />
            </Field>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-brand-600" checked={required} onChange={(e) => setRequired(e.target.checked)} />
                Required
              </label>
              {isEdit && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="accent-brand-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  Active
                </label>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [filters, setFilters] = useState({ userId: '', module: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any | null>(null);

  const logs = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: async () =>
      (await api.get('/admin/audit-logs', {
        params: {
          page,
          ...(filters.userId ? { userId: filters.userId } : {}),
          ...(filters.module ? { module: filters.module } : {}),
          ...(filters.from ? { from: filters.from } : {}),
          ...(filters.to ? { to: filters.to } : {}),
        },
      })).data as { data: any[]; meta: any },
  });

  const rows = logs.data?.data ?? [];
  const meta = logs.data?.meta ?? {};
  const totalPages = meta.totalPages ?? meta.pageCount ?? 1;

  const columns: Column<any>[] = [
    { key: 'createdAt', header: 'When', render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : '—') },
    { key: 'user', header: 'User', render: (r) => r.user?.name ?? r.userName ?? r.userId ?? '—' },
    { key: 'action', header: 'Action', render: (r) => <StatusBadge status={r.action} /> },
    { key: 'module', header: 'Module', render: (r) => String(r.module ?? '—').replace(/_/g, ' ') },
    { key: 'entity', header: 'Entity', render: (r) => r.entity ?? '—' },
    { key: 'entityId', header: 'Entity ID', render: (r) => r.entityId ?? '—' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="User ID">
            <input className="input" value={filters.userId} onChange={(e) => { setPage(1); setFilters({ ...filters, userId: e.target.value }); }} />
          </Field>
          <Field label="Module">
            <input className="input" value={filters.module} onChange={(e) => { setPage(1); setFilters({ ...filters, module: e.target.value }); }} />
          </Field>
          <Field label="From">
            <input type="date" className="input" value={filters.from} onChange={(e) => { setPage(1); setFilters({ ...filters, from: e.target.value }); }} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={filters.to} onChange={(e) => { setPage(1); setFilters({ ...filters, to: e.target.value }); }} />
          </Field>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        loading={logs.isLoading}
        onRowClick={(r) => setDetail(r)}
        emptyTitle="No audit entries"
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <button className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title="Audit entry">
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="label">When</div><div>{detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'}</div></div>
              <div><div className="label">User</div><div>{detail.user?.name ?? detail.userName ?? detail.userId ?? '—'}</div></div>
              <div><div className="label">Action</div><StatusBadge status={detail.action} /></div>
              <div><div className="label">Module</div><div>{detail.module ?? '—'}</div></div>
              <div><div className="label">Entity</div><div>{detail.entity ?? '—'}</div></div>
              <div><div className="label">Entity ID</div><div>{detail.entityId ?? '—'}</div></div>
            </div>
            <div>
              <div className="label">Old value</div>
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(detail.oldValue ?? detail.before ?? null, null, 2)}</pre>
            </div>
            <div>
              <div className="label">New value</div>
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(detail.newValue ?? detail.after ?? null, null, 2)}</pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
