'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getConfig, updateConfig, getSystemState, toggleModule, emergencyStop, resumeSystem,
} from '@/lib/api';
import {
  SlidersHorizontal, Bot, Link2, Shield, Zap,
  ToggleLeft, Settings2, Check, AlertCircle, Eye, EyeOff, RefreshCcw, Power,
  Brain, Target, Clock,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// ─── Types ────────────────────────────────────────────────────────────────────

type Config = Record<string, string>;

// ─── Workflow local settings (kept in localStorage, moved from WorkflowCard) ──

const WF_DEFAULTS: Record<string, Record<string, any>> = {
  connect:        { targetKeywords: '', targetTitles: '', maxPerWeek: 100 },
  feed:           { topicKeywords: '', maxPerSession: 10 },
  'first-message':{ tone: 'friendly' },
  replies:        { mode: 'auto' },
  followups:      { intervalDays: 5 },
  post:           { frequency: 'weekly' },
};

const WF_FIELDS: Record<string, { key: string; label: string; type: string; options?: string[] }[]> = {
  connect: [
    { key: 'targetKeywords', label: 'Target Keywords', type: 'text' },
    { key: 'targetTitles',   label: 'Target Job Titles', type: 'text' },
    { key: 'maxPerWeek',     label: 'Max Per Week', type: 'number' },
  ],
  feed: [
    { key: 'topicKeywords',  label: 'Topic Keywords', type: 'text' },
    { key: 'maxPerSession',  label: 'Max Comments / Session', type: 'number' },
  ],
  'first-message': [
    { key: 'tone', label: 'Message Tone', type: 'select', options: ['friendly', 'professional', 'casual'] },
  ],
  replies: [
    { key: 'mode', label: 'Reply Mode', type: 'select', options: ['auto', 'manual'] },
  ],
  followups: [
    { key: 'intervalDays', label: 'Follow-up After (days)', type: 'number' },
  ],
  post: [
    { key: 'frequency', label: 'Posting Frequency', type: 'select', options: ['daily', 'weekly', 'biweekly'] },
  ],
};

const WF_LABELS: Record<string, string> = {
  connect:         'Connect',
  'first-message': 'First Message',
  replies:         'Replies',
  followups:       'Follow-ups',
  feed:            'Feed',
  post:            'Post',
};

function loadWfSettings(name: string) {
  if (typeof window === 'undefined') return WF_DEFAULTS[name] || {};
  try {
    const s = localStorage.getItem(`wf-settings-${name}`);
    return s ? JSON.parse(s) : (WF_DEFAULTS[name] || {});
  } catch { return WF_DEFAULTS[name] || {}; }
}

function saveWfSettings(name: string, settings: Record<string, any>) {
  try { localStorage.setItem(`wf-settings-${name}`, JSON.stringify(settings)); } catch {}
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, subtitle, children }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/40">
        <div className="p-2 bg-primary/10 rounded-lg text-primary shadow-sm">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-300">{label}</label>
      {children}
      {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
    </div>
  );
}

const inputCls = "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary placeholder:text-slate-600 w-full";
const textareaCls = `${inputCls} resize-none leading-relaxed`;

function SaveButton({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`mt-4 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
        saved
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
      } disabled:opacity-50`}
    >
      {saved ? <Check size={13} /> : <Settings2 size={13} />}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ControlsPage() {
  const queryClient = useQueryClient();

  // Config (env vars) from backend
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  });

  // System state (module toggles)
  const { data: systemState, isLoading: stateLoading } = useQuery({
    queryKey: ['systemState'],
    queryFn: getSystemState,
    refetchInterval: 4000,
  });

  // Local draft config — seeded from server once loaded
  const [draft, setDraft] = useState<Config>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  const set = (key: string, value: string) => setDraft(d => ({ ...d, [key]: value }));

  // Per-section save state
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const saveSection = useCallback(async (section: string, keys: string[]) => {
    setSaving(s => ({ ...s, [section]: true }));
    const updates: Config = {};
    for (const k of keys) if (draft[k] !== undefined) updates[k] = draft[k];
    try {
      await updateConfig(updates);
      setSaved(s => ({ ...s, [section]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [section]: false })), 2500);
    } finally {
      setSaving(s => ({ ...s, [section]: false }));
    }
  }, [draft]);

  // Module toggles
  const toggleMut = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) =>
      toggleModule(module, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemState'] }),
  });

  const stopMut = useMutation({
    mutationFn: emergencyStop,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemState'] }),
  });

  const resumeMut = useMutation({
    mutationFn: resumeSystem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['systemState'] }),
  });

  // Workflow local settings
  const [wfSettings, setWfSettings] = useState<Record<string, Record<string, any>>>({});
  const [wfSaved, setWfSaved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const all: Record<string, Record<string, any>> = {};
    for (const name of Object.keys(WF_DEFAULTS)) all[name] = loadWfSettings(name);
    setWfSettings(all);
  }, []);

  const setWf = (workflow: string, key: string, value: any) => {
    setWfSettings(prev => {
      const updated = { ...prev, [workflow]: { ...prev[workflow], [key]: value } };
      saveWfSettings(workflow, updated[workflow]);
      return updated;
    });
    setWfSaved(s => ({ ...s, [workflow]: true }));
    setTimeout(() => setWfSaved(s => ({ ...s, [workflow]: false })), 1800);
  };

  const isLoading = configLoading || stateLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm animate-pulse">
        Loading controls…
      </div>
    );
  }

  const emergencyActive = !!systemState?.emergency_stop;

  // Module map: display label → runtime key (matches VALID_MODULES in RuntimeStateService minus prefix)
  const MODULES = [
    { key: 'task-connect',        label: 'Connection Engine',    desc: 'Sends connection requests' },
    { key: 'task-first-message',  label: 'First Message Engine', desc: 'Sends opening messages' },
    { key: 'task-reply-check',    label: 'Reply Check',          desc: 'Monitors inbox for replies' },
    { key: 'task-reply-respond',  label: 'Reply Respond',        desc: 'Generates & sends replies' },
    { key: 'task-followups',      label: 'Follow-up Engine',     desc: 'Handles follow-up messages' },
    { key: 'task-feed',           label: 'Feed Monitor',         desc: 'Comments on LinkedIn posts' },
    { key: 'task-post-content',   label: 'Post Content',         desc: 'Publishes LinkedIn posts' },
    { key: 'scheduler',           label: 'Scheduler',            desc: 'Cron-based task orchestration' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <SlidersHorizontal className="text-primary" size={30} />
            Controls
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            All manually configurable settings — env vars, module toggles, and workflow parameters.
          </p>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-card/50 border border-border/50 px-3 py-2 rounded-xl">
          Env changes take effect on next restart
        </div>
      </div>

      {/* ── Section 1: Emergency Controls ─────────────────────────────────── */}
      <SectionCard icon={Power} title="Emergency Controls" subtitle="System-wide safety switches">
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={() => stopMut.mutate()}
            disabled={stopMut.isPending || emergencyActive}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-sm hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
          >
            <Shield size={16} />
            {emergencyActive ? 'Emergency Stop ACTIVE' : 'Trigger Emergency Stop'}
          </button>
          {emergencyActive && (
            <button
              onClick={() => resumeMut.mutate()}
              disabled={resumeMut.isPending}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
            >
              <RefreshCcw size={16} />
              Resume System
            </button>
          )}
          {emergencyActive && (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
              <AlertCircle size={14} />
              System is halted — all tasks blocked
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Section 2: Claude AI Mode ─────────────────────────────────────── */}
      <SectionCard icon={Bot} title="Claude AI Mode" subtitle="How the bot talks to Claude AI">
        <div className="space-y-5">
          <Field label="AI Integration Mode" hint="cli = uses the claude CLI tool · web = opens claude.ai in a browser · api = uses the Anthropic REST API">
            <div className="flex gap-2 flex-wrap">
              {(['cli', 'web', 'api'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => set('CLAUDE_MODE', mode)}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold border transition-all duration-150 uppercase tracking-widest ${
                    draft['CLAUDE_MODE'] === mode
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Field>

          {draft['CLAUDE_MODE'] === 'api' && (
            <Field label="Anthropic API Key" hint="Required only when mode = api">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={draft['ANTHROPIC_API_KEY'] || ''}
                  onChange={e => set('ANTHROPIC_API_KEY', e.target.value)}
                  placeholder="sk-ant-..."
                  className={inputCls}
                />
                <button
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          )}
        </div>
        <SaveButton
          onClick={() => saveSection('claude', ['CLAUDE_MODE', 'ANTHROPIC_API_KEY'])}
          saving={saving['claude']}
          saved={saved['claude']}
        />
      </SectionCard>

      {/* ── Sections 3 + 4 side-by-side ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Section 3: LinkedIn Credentials */}
        <SectionCard icon={Link2} title="LinkedIn Account" subtitle="Login credentials">
          <div className="space-y-4">
            <Field label="Email Address">
              <input
                type="email"
                value={draft['LINKEDIN_EMAIL'] || ''}
                onChange={e => set('LINKEDIN_EMAIL', e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={draft['LINKEDIN_PASSWORD'] || ''}
                  onChange={e => set('LINKEDIN_PASSWORD', e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                />
                <button
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          </div>
          <SaveButton
            onClick={() => saveSection('linkedin', ['LINKEDIN_EMAIL', 'LINKEDIN_PASSWORD'])}
            saving={saving['linkedin']}
            saved={saved['linkedin']}
          />
        </SectionCard>

        {/* Section 4: Automation Safety */}
        <SectionCard icon={Shield} title="Automation Safety" subtitle="Rate limits and browser settings">
          <div className="space-y-4">
            <Field label="Weekly Connection Limit" hint="Hard cap — resets every 7 days">
              <input
                type="number"
                value={draft['WEEKLY_CONNECTION_LIMIT'] || ''}
                onChange={e => set('WEEKLY_CONNECTION_LIMIT', e.target.value)}
                min={1} max={200}
                className={inputCls}
              />
            </Field>
            <Field label="Headless Mode" hint="false = visible browser (required for first run / CAPTCHA)">
              <div className="flex gap-2">
                {(['true', 'false'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => set('HEADLESS', v)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                      draft['HEADLESS'] === v
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {v === 'true' ? 'Headless' : 'Visible'}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Slow Mo (ms)" hint="Delay between Playwright actions — higher = more human-like">
              <input
                type="number"
                value={draft['SLOW_MO'] || ''}
                onChange={e => set('SLOW_MO', e.target.value)}
                min={0} max={5000}
                className={inputCls}
              />
            </Field>
          </div>
          <SaveButton
            onClick={() => saveSection('safety', ['WEEKLY_CONNECTION_LIMIT', 'HEADLESS', 'SLOW_MO'])}
            saving={saving['safety']}
            saved={saved['safety']}
          />
        </SectionCard>
      </div>

      {/* ── Section 5: Module Toggles ─────────────────────────────────────── */}
      <SectionCard icon={ToggleLeft} title="Module Toggles" subtitle="Enable or disable individual automation modules">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MODULES.map(mod => {
            const flagKey = `${mod.key}_enabled`;
            const isEnabled = systemState?.[flagKey] !== false;
            return (
              <div
                key={mod.key}
                className="flex flex-col gap-2 p-4 rounded-xl border border-border/50 bg-slate-900/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">{mod.label}</span>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={checked => toggleMut.mutate({ module: mod.key, enabled: checked })}
                    disabled={toggleMut.isPending || emergencyActive}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{mod.desc}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-slate-600">Module toggles take effect immediately without restart.</p>
      </SectionCard>

      {/* ── Section 6: Product Context ────────────────────────────────────── */}
      <SectionCard icon={Brain} title="Product Context" subtitle="Injected into every Claude AI prompt">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Field label="Product Name">
            <input
              type="text"
              value={draft['PRODUCT_NAME'] || ''}
              onChange={e => set('PRODUCT_NAME', e.target.value)}
              placeholder="CUE AI"
              className={inputCls}
            />
          </Field>
          <Field label="Founder Name">
            <input
              type="text"
              value={draft['FOUNDER_NAME'] || ''}
              onChange={e => set('FOUNDER_NAME', e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </Field>
          <Field label="Founder Role">
            <input
              type="text"
              value={draft['FOUNDER_ROLE'] || ''}
              onChange={e => set('FOUNDER_ROLE', e.target.value)}
              placeholder="Founder"
              className={inputCls}
            />
          </Field>
          <div className="lg:col-span-2">
            <Field label="Product Description" hint="One-line pitch — sets the tone for all AI-generated messages">
              <textarea
                rows={3}
                value={draft['PRODUCT_DESCRIPTION'] || ''}
                onChange={e => set('PRODUCT_DESCRIPTION', e.target.value)}
                placeholder="A stealthy, always-on-top overlay that…"
                className={textareaCls}
              />
            </Field>
          </div>
        </div>
        <SaveButton
          onClick={() => saveSection('product', ['PRODUCT_NAME', 'PRODUCT_DESCRIPTION', 'FOUNDER_NAME', 'FOUNDER_ROLE'])}
          saving={saving['product']}
          saved={saved['product']}
        />
      </SectionCard>

      {/* ── Section 7: Target Audience ────────────────────────────────────── */}
      <SectionCard icon={Target} title="Target Audience" subtitle="ICP definitions used for AI scoring and outreach tone">
        <div className="space-y-4">
          <Field label="LinkedIn Search Keywords" hint="Comma-separated — used by the connect task to find profiles">
            <textarea
              rows={3}
              value={draft['TARGET_KEYWORDS'] || ''}
              onChange={e => set('TARGET_KEYWORDS', e.target.value)}
              placeholder="software engineer job search, developer interview…"
              className={textareaCls}
            />
          </Field>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Field label="Primary ICP" hint="People who actually buy — used for AI scoring">
              <textarea
                rows={4}
                value={draft['ICP_PRIMARY'] || ''}
                onChange={e => set('ICP_PRIMARY', e.target.value)}
                placeholder="Software engineers aged 21–30 in India…"
                className={textareaCls}
              />
            </Field>
            <Field label="Secondary ICP" hint="People who share and recommend">
              <textarea
                rows={4}
                value={draft['ICP_SECONDARY'] || ''}
                onChange={e => set('ICP_SECONDARY', e.target.value)}
                placeholder="Final year CS students…"
                className={textareaCls}
              />
            </Field>
            <Field label="Tertiary ICP" hint="Amplifiers — don't buy, but recommend at scale">
              <textarea
                rows={4}
                value={draft['ICP_TERTIARY'] || ''}
                onChange={e => set('ICP_TERTIARY', e.target.value)}
                placeholder="Career coaches and placement officers…"
                className={textareaCls}
              />
            </Field>
            <Field label="Exclude (NOT the audience)" hint="Instruct Claude to score these low">
              <textarea
                rows={4}
                value={draft['ICP_EXCLUDE'] || ''}
                onChange={e => set('ICP_EXCLUDE', e.target.value)}
                placeholder="Experienced professionals with 5+ years…"
                className={textareaCls}
              />
            </Field>
          </div>
          <Field label="Core User Persona" hint="The single clearest picture of your core user — sets tone in every prompt">
            <textarea
              rows={3}
              value={draft['ICP_CORE_USER'] || ''}
              onChange={e => set('ICP_CORE_USER', e.target.value)}
              placeholder="A 23-year-old software engineer with 1–2 years of experience…"
              className={textareaCls}
            />
          </Field>
        </div>
        <SaveButton
          onClick={() => saveSection('audience', ['TARGET_KEYWORDS', 'ICP_PRIMARY', 'ICP_SECONDARY', 'ICP_TERTIARY', 'ICP_EXCLUDE', 'ICP_CORE_USER'])}
          saving={saving['audience']}
          saved={saved['audience']}
        />
      </SectionCard>

      {/* ── Section 8: Scheduling ─────────────────────────────────────────── */}
      <SectionCard icon={Clock} title="Scheduling" subtitle="Cron expression for automated runs">
        <div className="max-w-sm">
          <Field label="Cron Schedule" hint='Default: "0 9 * * 1" = every Monday at 9am · Uses standard 5-field cron syntax'>
            <input
              type="text"
              value={draft['CRON_SCHEDULE'] || ''}
              onChange={e => set('CRON_SCHEDULE', e.target.value)}
              placeholder="0 9 * * 1"
              className={inputCls}
            />
          </Field>
        </div>
        <SaveButton
          onClick={() => saveSection('schedule', ['CRON_SCHEDULE'])}
          saving={saving['schedule']}
          saved={saved['schedule']}
        />
      </SectionCard>

      {/* ── Section 9: Workflow Settings ──────────────────────────────────── */}
      <SectionCard icon={Zap} title="Workflow Settings" subtitle="Per-workflow parameters — applied on next run · saved locally">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(WF_FIELDS).map(([wfName, fields]) => (
            <div
              key={wfName}
              className="flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-slate-900/40"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                  {WF_LABELS[wfName] ?? wfName}
                </span>
                {wfSaved[wfName] && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <Check size={10} /> Saved
                  </span>
                )}
              </div>
              {fields.map(field => (
                <div key={field.key} className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 font-medium">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={wfSettings[wfName]?.[field.key] ?? ''}
                      onChange={e => setWf(wfName, field.key, e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-primary"
                    >
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={wfSettings[wfName]?.[field.key] ?? ''}
                      onChange={e => setWf(
                        wfName, field.key,
                        field.type === 'number' ? Number(e.target.value) : e.target.value,
                      )}
                      placeholder={field.type === 'text' ? 'e.g. recruiter, HR' : ''}
                      className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-primary placeholder:text-slate-600"
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-slate-600">
          Workflow settings are stored in browser localStorage and applied when each workflow runs.
        </p>
      </SectionCard>
    </div>
  );
}
