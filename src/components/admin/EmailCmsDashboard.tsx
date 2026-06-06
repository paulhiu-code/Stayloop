import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  Mail,
  Plus,
  Save,
  Search,
  Send,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  buildHostCustomSlug,
  buildSampleVariables,
  EMAIL_CATEGORIES,
  EmailDeliveryLog,
  EmailSequence,
  EmailSequenceStep,
  EmailTriggerWithTemplate,
  getTemplateForTrigger,
  getTriggerWiring,
  HOST_EMAIL_CATEGORIES,
  HostEmailListItem,
  HostLifecycleOverride,
  mergeHostEmailCatalog,
  renderTemplateString,
  type EmailCmsMode,
} from '../../lib/emailCms';
import { supabase } from '../../lib/supabase';

type TabId = 'templates' | 'sequences' | 'logs';

const CUSTOM_TIMING_OPTIONS = [
  { label: 'When booking is confirmed', anchor: 'trigger', delay: '0 seconds' },
  { label: '48 hours before check-in', anchor: 'check_in', delay: '-2 days' },
  { label: 'Morning of check-in', anchor: 'check_in', delay: '0 days' },
  { label: '3 hours after checkout', anchor: 'check_out', delay: '3 hours' },
  { label: 'Manual send only', anchor: 'manual', delay: '0 seconds' },
] as const;

export default function EmailCmsDashboard({
  onClose,
  embedded = false,
  mode = 'admin',
}: {
  onClose: () => void;
  embedded?: boolean;
  mode?: EmailCmsMode;
}) {
  const { profile, user } = useAuth();
  const isHostMode = mode === 'host';
  const categories = isHostMode ? HOST_EMAIL_CATEGORIES : EMAIL_CATEGORIES;
  const [tab, setTab] = useState<TabId>('templates');
  const [triggers, setTriggers] = useState<EmailTriggerWithTemplate[]>([]);
  const [catalogItems, setCatalogItems] = useState<HostEmailListItem[]>([]);
  const [platformTriggers, setPlatformTriggers] = useState<EmailTriggerWithTemplate[]>([]);
  const [lifecycleOverrides, setLifecycleOverrides] = useState<HostLifecycleOverride[]>([]);
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [steps, setSteps] = useState<EmailSequenceStep[]>([]);
  const [logs, setLogs] = useState<EmailDeliveryLog[]>([]);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<(typeof EMAIL_CATEGORIES)[number]>('all');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [textBody, setTextBody] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [testEmail, setTestEmail] = useState(profile?.email ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(true);
  const [showNewEmail, setShowNewEmail] = useState(false);
  const [newEmailName, setNewEmailName] = useState('');
  const [newEmailDescription, setNewEmailDescription] = useState('');
  const [newEmailTiming, setNewEmailTiming] = useState(0);

  const selectedCatalogItem =
    isHostMode ? catalogItems.find((item) => item.id === selectedTriggerId) ?? null : null;
  const selectedTrigger =
    (isHostMode ? selectedCatalogItem : triggers.find((trigger) => trigger.id === selectedTriggerId)) ?? null;
  const selectedTemplate = selectedTrigger ? getTemplateForTrigger(selectedTrigger) : null;
  const canEditSelected =
    !isHostMode || Boolean(selectedCatalogItem?.isEditable && selectedTrigger?.host_id === user?.id);
  const isPlatformDefault = isHostMode && selectedCatalogItem?.source === 'platform-default';
  const sampleVariables = useMemo(
    () => buildSampleVariables(selectedTrigger?.variables_schema),
    [selectedTrigger]
  );
  const renderedPreview = useMemo(
    () => ({
      subject: renderTemplateString(subject, sampleVariables),
      html: renderTemplateString(htmlBody, sampleVariables),
      text: renderTemplateString(textBody, sampleVariables),
    }),
    [subject, htmlBody, textBody, sampleVariables]
  );

  useEffect(() => {
    loadAll();
  }, [mode, user?.id]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setSubject(selectedTemplate.subject);
    setHtmlBody(selectedTemplate.html_body);
    setTextBody(selectedTemplate.text_body);
    setPreviewText(selectedTemplate.preview_text);
  }, [selectedTemplate?.id]);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      if (isHostMode) {
        if (!user?.id) throw new Error('Sign in required.');

        const [platformRes, hostRes, logRes, lifecycleRes, sequenceRes, stepRes] = await Promise.all([
          supabase
            .from('email_triggers')
            .select('*, email_templates(*)')
            .is('host_id', null)
            .eq('host_editable', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('email_triggers')
            .select('*, email_templates(*)')
            .eq('host_id', user.id)
            .order('sort_order', { ascending: true }),
          supabase
            .from('email_delivery_log')
            .select('id, trigger_slug, recipient, subject, status, provider_message_id, error_message, sent_at')
            .eq('host_id', user.id)
            .order('sent_at', { ascending: false })
            .limit(50),
          supabase
            .from('email_host_lifecycle_overrides')
            .select('*')
            .eq('host_id', user.id),
          supabase.from('email_sequences').select('*').eq('slug', 'booking.lifecycle').limit(1),
          supabase
            .from('email_sequence_steps')
            .select('*, email_triggers(slug, name)')
            .order('step_order', { ascending: true }),
        ]);

        if (platformRes.error) throw platformRes.error;
        if (hostRes.error) throw hostRes.error;
        if (logRes.error) throw logRes.error;
        if (lifecycleRes.error) throw lifecycleRes.error;
        if (sequenceRes.error) throw sequenceRes.error;
        if (stepRes.error) throw stepRes.error;

        const platformRows = (platformRes.data ?? []) as EmailTriggerWithTemplate[];
        const hostRows = (hostRes.data ?? []) as EmailTriggerWithTemplate[];
        const merged = mergeHostEmailCatalog(platformRows, hostRows);

        setPlatformTriggers(platformRows);
        setCatalogItems(merged);
        setTriggers(merged);
        setLifecycleOverrides((lifecycleRes.data ?? []) as HostLifecycleOverride[]);
        setSequences((sequenceRes.data ?? []) as EmailSequence[]);
        setSteps((stepRes.data ?? []) as EmailSequenceStep[]);
        setLogs((logRes.data ?? []) as EmailDeliveryLog[]);

        if (!selectedTriggerId && merged[0]) {
          setSelectedTriggerId(merged[0].id);
        }
        return;
      }

      const [triggerRes, sequenceRes, stepRes, logRes] = await Promise.all([
        supabase
          .from('email_triggers')
          .select('*, email_templates(*)')
          .is('host_id', null)
          .order('sort_order', { ascending: true }),
        supabase.from('email_sequences').select('*').order('name', { ascending: true }),
        supabase
          .from('email_sequence_steps')
          .select('*, email_triggers(slug, name)')
          .order('step_order', { ascending: true }),
        supabase
          .from('email_delivery_log')
          .select('id, trigger_slug, recipient, subject, status, provider_message_id, error_message, sent_at')
          .order('sent_at', { ascending: false })
          .limit(50),
      ]);

      if (triggerRes.error) throw triggerRes.error;
      if (sequenceRes.error) throw sequenceRes.error;
      if (stepRes.error) throw stepRes.error;
      if (logRes.error) throw logRes.error;

      const triggerRows = (triggerRes.data ?? []) as EmailTriggerWithTemplate[];
      setTriggers(triggerRows);
      setSequences((sequenceRes.data ?? []) as EmailSequence[]);
      setSteps((stepRes.data ?? []) as EmailSequenceStep[]);
      setLogs((logRes.data ?? []) as EmailDeliveryLog[]);

      if (!selectedTriggerId && triggerRows[0]) {
        setSelectedTriggerId(triggerRows[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email CMS data.');
    } finally {
      setLoading(false);
    }
  }

  const filteredTriggers = (isHostMode ? catalogItems : triggers).filter((trigger) => {
    const matchesCategory = categoryFilter === 'all' || trigger.category === categoryFilter;
    const haystack = `${trigger.name} ${trigger.slug} ${trigger.description}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  async function customizePlatformEmail(platformSlug: string) {
    if (!user?.id) return;
    setSaving(true);
    setError('');
    try {
      const platform = platformTriggers.find((trigger) => trigger.slug === platformSlug);
      const template = platform ? getTemplateForTrigger(platform) : null;
      if (!platform || !template) throw new Error('Platform template not found.');

      const { data: triggerRows, error: triggerError } = await supabase
        .from('email_triggers')
        .insert({
          host_id: user.id,
          platform_trigger_slug: platformSlug,
          slug: platformSlug,
          name: platform.name,
          description: platform.description,
          category: platform.category,
          recipient_role: platform.recipient_role,
          variables_schema: platform.variables_schema,
          is_active: true,
          sort_order: platform.sort_order,
          is_host_custom: false,
        })
        .select('*')
        .single();

      if (triggerError) throw triggerError;

      const { error: templateError } = await supabase.from('email_templates').insert({
        trigger_id: triggerRows.id,
        subject: template.subject,
        html_body: template.html_body,
        text_body: template.text_body,
        preview_text: template.preview_text,
        is_published: true,
        version: 1,
        updated_by: user.id,
      });

      if (templateError) throw templateError;
      setMessage('Your customized version is ready to edit.');
      await loadAll();
      setSelectedTriggerId(triggerRows.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customized email.');
    } finally {
      setSaving(false);
    }
  }

  async function createCustomEmail() {
    if (!user?.id || !newEmailName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const timing = CUSTOM_TIMING_OPTIONS[newEmailTiming] ?? CUSTOM_TIMING_OPTIONS[4];
      const slug = buildHostCustomSlug(user.id, newEmailName);
      const defaultSubject = newEmailName.trim();
      const defaultBody = `<p>Hi {{guest_name}},</p><p>${newEmailDescription || 'Add your message for guests here.'}</p><p>We look forward to hosting you at {{property_title}}.</p>`;

      const { data: triggerRows, error: triggerError } = await supabase
        .from('email_triggers')
        .insert({
          host_id: user.id,
          slug,
          name: newEmailName.trim(),
          description: newEmailDescription.trim() || 'Custom host email for guests.',
          category: 'custom',
          recipient_role: 'guest',
          variables_schema: [
            { key: 'guest_name', label: 'Guest name', sample: 'Alex Rivera' },
            { key: 'host_name', label: 'Host name', sample: profile?.full_name || 'Host' },
            { key: 'property_title', label: 'Property title', sample: 'Lakeview Cabin Retreat' },
            { key: 'site_url', label: 'Site URL', sample: 'https://stay-loop.co' },
          ],
          is_active: true,
          sort_order: 900,
          is_host_custom: true,
          send_timing:
            timing.anchor === 'manual'
              ? { mode: 'manual' }
              : { anchor: timing.anchor, delay_interval: timing.delay },
        })
        .select('*')
        .single();

      if (triggerError) throw triggerError;

      const { error: templateError } = await supabase.from('email_templates').insert({
        trigger_id: triggerRows.id,
        subject: defaultSubject,
        html_body: defaultBody,
        text_body: defaultBody.replace(/<[^>]+>/g, ' '),
        preview_text: newEmailDescription.trim() || defaultSubject,
        is_published: true,
        version: 1,
        updated_by: user.id,
      });

      if (templateError) throw templateError;

      setShowNewEmail(false);
      setNewEmailName('');
      setNewEmailDescription('');
      setNewEmailTiming(0);
      setMessage('Custom email created. StayLoop branding is preserved automatically.');
      await loadAll();
      setSelectedTriggerId(triggerRows.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create custom email.');
    } finally {
      setSaving(false);
    }
  }

  async function saveLifecycleOverride(stepSlug: string, delayInterval: string, delayAnchor: string) {
    if (!user?.id) return;
    const { error: upsertError } = await supabase.from('email_host_lifecycle_overrides').upsert(
      {
        host_id: user.id,
        platform_step_slug: stepSlug,
        delay_interval: delayInterval,
        delay_anchor: delayAnchor,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'host_id,platform_step_slug' }
    );
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setMessage('Lifecycle timing updated for your listings.');
    await loadAll();
  }

  async function saveTemplate() {
    if (!selectedTrigger || !selectedTemplate || !user || !canEditSelected) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { error: updateError } = await supabase
        .from('email_templates')
        .update({
          subject,
          html_body: htmlBody,
          text_body: textBody,
          preview_text: previewText,
          version: selectedTemplate.version + 1,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTemplate.id);

      if (updateError) throw updateError;
      setMessage('Template saved and revision recorded.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTriggerActive() {
    if (!selectedTrigger || !canEditSelected || !selectedTrigger.host_id) return;
    const { error: updateError } = await supabase
      .from('email_triggers')
      .update({ is_active: !selectedTrigger.is_active })
      .eq('id', selectedTrigger.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadAll();
  }

  async function sendTestEmail() {
    if (!selectedTrigger || !testEmail.trim()) return;
    setSending(true);
    setError('');
    setMessage('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('You must be signed in to send test emails.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '');
      const triggerSlug =
        isHostMode && selectedCatalogItem?.platformSlug
          ? selectedCatalogItem.platformSlug
          : selectedTrigger.slug;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send',
          trigger: triggerSlug,
          hostId: isHostMode ? user?.id : undefined,
          to: testEmail.trim(),
          subject,
          html: htmlBody,
          text: textBody,
          variables: sampleVariables,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Test send failed.');
      setMessage(`Test email sent to ${testEmail.trim()}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email.');
    } finally {
      setSending(false);
    }
  }

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    setHtmlBody((current) => `${current}${current.endsWith('>') || current.length === 0 ? '' : ' '}${token}`);
    setTextBody((current) => `${current}${current.length === 0 ? '' : ' '}${token}`);
  }

  return (
    <div className={`${embedded ? 'min-h-0' : 'min-h-screen'} bg-slate-950 text-white`}>
      <div className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-300">
              {isHostMode ? 'StayLoop Host' : 'StayLoop Admin'}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold">{isHostMode ? 'Guest emails' : 'Email CMS'}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {isHostMode
                ? 'Customize guest correspondence for your listings. StayLoop branding stays on all emails.'
                : 'Edit transactional templates, preview with sample data, and send tests.'}
            </p>
          </div>
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to site
            </button>
          )}
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 pb-4 sm:px-6">
          {([
            ['templates', 'Templates'],
            ['sequences', isHostMode ? 'Timing' : 'Sequences'],
            ['logs', 'Send log'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === id ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-100">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {message && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-green-100">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{message}</p>
          </div>
        )}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">Loading email CMS…</div>
        ) : tab === 'templates' ? (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search triggers"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-10 py-2.5 text-sm text-white outline-none ring-orange-400 focus:ring-2"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                      categoryFilter === category ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              {isHostMode && (
                <button
                  type="button"
                  onClick={() => setShowNewEmail(true)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  New custom email
                </button>
              )}
              <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
                {filteredTriggers.map((trigger) => {
                  const active = trigger.id === selectedTriggerId;
                  const hostItem = isHostMode ? (trigger as HostEmailListItem) : null;
                  const wiring = getTriggerWiring(hostItem?.platformSlug ?? trigger.slug);
                  const wiringClass =
                    wiring.status === 'live'
                      ? 'bg-green-500/15 text-green-300'
                      : wiring.status === 'scheduled'
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'bg-slate-700 text-slate-300';
                  return (
                    <button
                      key={trigger.id}
                      type="button"
                      onClick={() => setSelectedTriggerId(trigger.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active ? 'border-orange-400/40 bg-orange-500/10' : 'border-white/5 bg-slate-900/40 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">{trigger.name}</span>
                        <div className="flex items-center gap-2">
                          {isHostMode && hostItem && (
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                              {hostItem.source === 'platform-default'
                                ? 'Default'
                                : hostItem.source === 'host-custom'
                                  ? 'Custom'
                                  : 'Yours'}
                            </span>
                          )}
                          {!isHostMode && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${wiringClass}`}>
                              {wiring.status}
                            </span>
                          )}
                          {!trigger.is_active && (
                            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase">Off</span>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{trigger.slug}</p>
                    </button>
                  );
                })}
              </div>
            </aside>

            {selectedTrigger && selectedTemplate ? (
              <section className="space-y-6">
                {isPlatformDefault && selectedCatalogItem?.platformSlug && (
                  <div className="rounded-3xl border border-orange-400/30 bg-orange-500/10 p-5">
                    <p className="text-sm text-orange-100">
                      You are viewing the StayLoop default for this email. Customize it to change what your guests receive while keeping StayLoop branding.
                    </p>
                    <button
                      type="button"
                      onClick={() => customizePlatformEmail(selectedCatalogItem.platformSlug!)}
                      disabled={saving}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {saving ? 'Creating…' : 'Customize for my listings'}
                    </button>
                  </div>
                )}
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">{selectedTrigger.category}</p>
                      <h2 className="mt-2 text-2xl font-bold">{selectedTrigger.name}</h2>
                      <p className="mt-2 max-w-2xl text-sm text-slate-400">{selectedTrigger.description}</p>
                      {(() => {
                        const wiring = getTriggerWiring(selectedTrigger.slug);
                        return (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
                            <p>
                              <span className="font-semibold text-orange-200">Automation:</span> {wiring.detail}
                            </p>
                            {wiring.cadence && (
                              <p className="mt-1">
                                <span className="font-semibold text-orange-200">Cadence:</span> {wiring.cadence}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      <p className="mt-3 text-xs text-slate-500">Version {selectedTemplate.version} · Recipient: {selectedTrigger.recipient_role}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canEditSelected && (
                        <button
                          type="button"
                          onClick={toggleTriggerActive}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold"
                        >
                          {selectedTrigger.is_active ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                          {selectedTrigger.is_active ? 'Trigger enabled' : 'Trigger disabled'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPreview((value) => !value)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold"
                      >
                        <Eye className="h-4 w-4" />
                        {showPreview ? 'Hide preview' : 'Show preview'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-200">Subject line</span>
                      <input
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        disabled={!canEditSelected}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring-2 disabled:opacity-60"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-200">Preview text</span>
                      <input
                        value={previewText}
                        onChange={(event) => setPreviewText(event.target.value)}
                        disabled={!canEditSelected}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring-2 disabled:opacity-60"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-200">HTML body</span>
                      <textarea
                        value={htmlBody}
                        onChange={(event) => setHtmlBody(event.target.value)}
                        rows={18}
                        disabled={!canEditSelected}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-xs leading-6 outline-none ring-orange-400 focus:ring-2 disabled:opacity-60"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-200">Plain text fallback</span>
                      <textarea
                        value={textBody}
                        onChange={(event) => setTextBody(event.target.value)}
                        rows={8}
                        disabled={!canEditSelected}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-xs leading-6 outline-none ring-orange-400 focus:ring-2 disabled:opacity-60"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={saveTemplate}
                        disabled={saving || !canEditSelected}
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving…' : 'Save template'}
                      </button>
                      <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 py-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <input
                          value={testEmail}
                          onChange={(event) => setTestEmail(event.target.value)}
                          placeholder="Test recipient email"
                          className="w-full bg-transparent text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={sendTestEmail}
                          disabled={sending}
                          className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {sending ? 'Sending…' : 'Send test'}
                        </button>
                      </div>
                    </div>

                    {showPreview && (
                      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-900">
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Live preview</p>
                          <p className="mt-2 text-sm font-semibold">{renderedPreview.subject}</p>
                        </div>
                        <iframe
                          title="Email preview"
                          srcDoc={renderedPreview.html}
                          className="h-[640px] w-full bg-white"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 xl:sticky xl:top-6">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-300">Variables</h3>
                      <p className="mt-2 text-sm text-slate-400">Click to insert placeholders into the template.</p>
                      <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
                        {selectedTrigger.variables_schema.map((variable) => (
                          <button
                            key={variable.key}
                            type="button"
                            onClick={() => insertVariable(variable.key)}
                            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-left transition hover:border-orange-400/30"
                          >
                            <div className="font-mono text-xs text-orange-200">{`{{${variable.key}}}`}</div>
                            <div className="mt-1 text-xs text-slate-400">{variable.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">
                Select a trigger to edit its template.
              </div>
            )}
          </div>
        ) : tab === 'sequences' ? (
          <div className="space-y-6">
            {isHostMode ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-bold">Guest email timing</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Adjust when automated guest emails send for your listings. Platform defaults follow Airbnb-style cadence.
                </p>
                <div className="mt-5 space-y-3">
                  {steps
                    .filter((step) => step.email_triggers.slug !== 'booking.confirmed.guest')
                    .map((step) => {
                      const override = lifecycleOverrides.find(
                        (item) => item.platform_step_slug === step.email_triggers.slug
                      );
                      return (
                        <div key={step.id} className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-4">
                          <p className="font-semibold">{step.email_triggers.name}</p>
                          <p className="mt-1 text-xs text-slate-400">{step.email_triggers.slug}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <select
                              defaultValue={override?.delay_interval ?? step.delay_interval}
                              onChange={(event) => {
                                const option = CUSTOM_TIMING_OPTIONS.find(
                                  (item) => item.delay === event.target.value
                                );
                                if (!option || option.anchor === 'manual') return;
                                saveLifecycleOverride(step.email_triggers.slug, option.delay, option.anchor);
                              }}
                              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                            >
                              {CUSTOM_TIMING_OPTIONS.filter((item) => item.anchor !== 'manual').map((item) => (
                                <option key={item.label} value={item.delay}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                            <span className="text-xs text-slate-500">
                              Platform default: {step.delay_interval} · {step.delay_anchor.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              sequences.map((sequence) => (
              <div key={sequence.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{sequence.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">{sequence.description}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sequence.is_active ? 'bg-green-500/15 text-green-300' : 'bg-slate-700 text-slate-300'}`}>
                    {sequence.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {steps.filter((step) => step.sequence_id === sequence.id).map((step) => (
                    <div key={step.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-200">
                        {step.step_order + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{step.email_triggers.name}</p>
                        <p className="text-xs text-slate-400">{step.email_triggers.slug}</p>
                      </div>
                      <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                        <Clock3 className="h-4 w-4" />
                        {step.delay_interval} · {step.delay_anchor.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Sent</th>
                  <th className="px-4 py-3 font-semibold">Trigger</th>
                  <th className="px-4 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-slate-400">{new Date(log.sent_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs text-orange-200">{log.trigger_slug}</td>
                    <td className="px-4 py-3">{log.recipient}</td>
                    <td className="px-4 py-3">{log.subject}</td>
                    <td className="px-4 py-3 capitalize">{log.status}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      No delivery events yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showNewEmail && isHostMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
            <h2 className="text-2xl font-bold">New custom email</h2>
            <p className="mt-2 text-sm text-slate-400">
              Create an extra guest email for forms, agreements, or arrival details. StayLoop branding stays on the template shell.
            </p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm">
                <span className="font-semibold text-slate-200">Email name</span>
                <input
                  value={newEmailName}
                  onChange={(event) => setNewEmailName(event.target.value)}
                  placeholder="House rules agreement"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-200">Description</span>
                <textarea
                  value={newEmailDescription}
                  onChange={(event) => setNewEmailDescription(event.target.value)}
                  rows={3}
                  placeholder="Ask guests to confirm pet policy and parking instructions."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-200">When should it send?</span>
                <select
                  value={newEmailTiming}
                  onChange={(event) => setNewEmailTiming(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm"
                >
                  {CUSTOM_TIMING_OPTIONS.map((option, index) => (
                    <option key={option.label} value={index}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowNewEmail(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createCustomEmail}
                disabled={saving || !newEmailName.trim()}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
