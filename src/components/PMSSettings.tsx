import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Plus,
  Settings,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Copy,
  CalendarDays,
  ArrowLeftRight,
  Download,
} from 'lucide-react';
import {
  pmsProviders,
  createProviderConnection,
  getPMSConnections,
  syncPMSProperties,
  syncPMSBookings,
  syncAllPMS,
  syncAllPMSAvailability,
  getPMSWebhookUrl,
  isPMSAutoSyncEnabled,
  setPMSAutoSync,
  setPMSSyncDirection,
  getSyncLogs,
  deletePMSConnection,
  togglePMSConnection,
  getHostProperties,
  getICalExportUrl,
  getICalFeeds,
  addICalFeed,
  deleteICalFeed,
  importICalFeeds,
  type PMSConnection,
  type PMSSyncLog,
  type PMSProvider,
  type PMSSyncDirection,
  type HostProperty,
  type ICalFeed,
} from '../lib/pms';

const SYNC_DIRECTION_LABELS: Record<PMSSyncDirection, string> = {
  inbound: 'Import only (PMS → StayLoop)',
  outbound: 'Export only (StayLoop → PMS)',
  two_way: 'Two-way sync',
};

export default function PMSSettings() {
  const [connections, setConnections] = useState<PMSConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<Record<string, PMSSyncLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PMSProvider | null>(null);
  const [accountName, setAccountName] = useState('');
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [connectDirection, setConnectDirection] = useState<PMSSyncDirection>('two_way');
  const [creating, setCreating] = useState(false);

  // iCal channel state
  const [properties, setProperties] = useState<HostProperty[]>([]);
  const [feeds, setFeeds] = useState<ICalFeed[]>([]);
  const [newFeedProperty, setNewFeedProperty] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedLabel, setNewFeedLabel] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadConnections();
    loadICal();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await getPMSConnections();
      setConnections(data);
      for (const conn of data) {
        const logs = await getSyncLogs(conn.id, 10);
        setSyncLogs((prev) => ({ ...prev, [conn.id]: logs }));
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadICal = async () => {
    try {
      const [props, feedList] = await Promise.all([getHostProperties(), getICalFeeds()]);
      setProperties(props);
      setFeeds(feedList);
      if (props.length > 0 && !newFeedProperty) setNewFeedProperty(props[0].id);
    } catch (error) {
      console.error('Failed to load iCal data:', error);
    }
  };

  const handleSync = async (
    connectionId: string,
    type: 'properties' | 'bookings' | 'availability' | 'all'
  ) => {
    setSyncing(connectionId);
    try {
      if (type === 'properties') {
        await syncPMSProperties(connectionId);
      } else if (type === 'bookings') {
        await syncPMSBookings(connectionId);
      } else if (type === 'availability') {
        const result = await syncAllPMSAvailability(connectionId);
        const summaryLines = result.properties.map((property) => {
          if (property.error) {
            return `• Property ${property.pmsPropertyId}: failed — ${property.error}`;
          }
          return `• Property ${property.pmsPropertyId}: ${property.blockedNights ?? 0} blocked nights, ${property.availableNights ?? 0} open nights (${property.pricingNights ?? 0} priced nights synced)`;
        });
        const summary = summaryLines.length > 0 ? `

${summaryLines.join('
')}` : '';
        alert(
          `Calendar sync finished: ${result.succeeded}/${result.processed} properties updated.${summary}

If blocked nights is 0 for a property that has reservations in OwnerRez, the sync could not read reservations — check OwnerRez email on the connection and Edge Function logs.`
        );
      } else {
        await syncAllPMS(connectionId);
        alert('Full sync finished (calendars, pricing, and bookings).');
      }
      await loadConnections();
    } catch (error) {
      console.error('Sync failed:', error);
      alert(error instanceof Error ? error.message : 'Sync failed. Please try again.');
    } finally {
      setSyncing(null);
    }
  };

  const handleAutoSyncToggle = async (connection: PMSConnection) => {
    const next = !isPMSAutoSyncEnabled(connection);
    try {
      await setPMSAutoSync(connection.id, next);
      await loadConnections();
    } catch (error) {
      console.error('Auto-sync toggle failed:', error);
      alert('Could not update automatic sync. Please try again.');
    }
  };

  const handleDirectionChange = async (connection: PMSConnection, direction: PMSSyncDirection) => {
    try {
      await setPMSSyncDirection(connection.id, direction);
      await loadConnections();
    } catch (error) {
      console.error('Direction change failed:', error);
      alert('Could not update sync direction. Please try again.');
    }
  };

  const copyWebhookUrl = async (connection: PMSConnection) => {
    const url = getPMSWebhookUrl(connection.id, connection.pms_provider);
    if (!url) {
      alert('Webhook URL is unavailable. Check VITE_SUPABASE_URL in your deployment.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      alert('Webhook URL copied. Paste it into your PMS webhook settings.');
    } catch {
      prompt('Copy this webhook URL into your PMS:', url);
    }
  };

  const handleToggle = async (connectionId: string, isActive: boolean) => {
    try {
      await togglePMSConnection(connectionId, !isActive);
      await loadConnections();
    } catch (error) {
      console.error('Toggle failed:', error);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Remove this connection? Synced data stays, but automatic sync stops.')) return;
    try {
      await deletePMSConnection(connectionId);
      await loadConnections();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const resetConnectionForm = () => {
    setSelectedProvider(null);
    setAccountName('');
    setCredentialValues({});
    setConnectDirection('two_way');
  };

  const providerInfo = pmsProviders.find((p) => p.id === selectedProvider);

  const requiredFieldsFilled = providerInfo
    ? providerInfo.fields.every((f) => f.optional || credentialValues[f.key]?.trim())
    : false;

  const handleCreateConnection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProvider || !requiredFieldsFilled) return;

    setCreating(true);
    try {
      await createProviderConnection(
        selectedProvider,
        accountName.trim(),
        credentialValues,
        connectDirection
      );
      resetConnectionForm();
      setShowAddConnection(false);
      await loadConnections();
    } catch (error) {
      console.error('Connection failed:', error);
      alert(error instanceof Error ? error.message : 'Connection failed. Please check your credentials.');
    } finally {
      setCreating(false);
    }
  };

  const copyExportUrl = async (property: HostProperty) => {
    const url = getICalExportUrl(property);
    if (!url) {
      alert('Export URL unavailable for this property.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      alert('StayLoop calendar URL copied. Paste it into Airbnb / VRBO / your PMS to import.');
    } catch {
      prompt('Copy this StayLoop calendar (iCal) URL:', url);
    }
  };

  const handleAddFeed = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newFeedProperty || !newFeedUrl.trim()) return;
    try {
      await addICalFeed(newFeedProperty, newFeedUrl, newFeedLabel);
      setNewFeedUrl('');
      setNewFeedLabel('');
      await loadICal();
    } catch (error) {
      console.error('Add feed failed:', error);
      alert(error instanceof Error ? error.message : 'Could not add feed.');
    }
  };

  const handleImportFeeds = async () => {
    setImporting(true);
    try {
      await importICalFeeds();
      await loadICal();
      alert('Calendar import finished.');
    } catch (error) {
      console.error('Import failed:', error);
      alert(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteFeed = async (feedId: string) => {
    try {
      await deleteICalFeed(feedId);
      await loadICal();
    } catch (error) {
      console.error('Delete feed failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">PMS Integrations</h2>
          <p className="text-gray-600 mt-2">
            Connect OwnerRez, Guesty, or Hostaway to sync properties, bookings, and calendars — two-way, in real time.
          </p>
        </div>
        <button
          onClick={() => setShowAddConnection(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Add Connection
        </button>
      </div>

      {showAddConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Connect Your PMS</h3>
              <button
                onClick={() => {
                  setShowAddConnection(false);
                  resetConnectionForm();
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {pmsProviders.map((provider) => (
                <div
                  key={provider.id}
                  className={`border-2 rounded-2xl p-6 transition-all duration-300 ${
                    selectedProvider === provider.id
                      ? 'border-orange-400 bg-orange-50/60'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h4 className="text-xl font-bold text-gray-900">{provider.name}</h4>
                  </div>
                  <p className="text-gray-600 mb-4 text-sm">{provider.description}</p>

                  <div className="space-y-2 mb-6">
                    {provider.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <a
                      href={provider.setupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Setup Guide
                    </a>
                    <button
                      onClick={() => {
                        setSelectedProvider(provider.id);
                        setCredentialValues({});
                      }}
                      className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:shadow-lg transition"
                    >
                      Connect {provider.name}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {providerInfo && (
              <form
                onSubmit={handleCreateConnection}
                className="mt-8 rounded-2xl border-2 border-orange-200 bg-orange-50/60 p-6"
              >
                <div className="mb-5">
                  <h4 className="text-xl font-bold text-gray-900">Connect {providerInfo.name}</h4>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Enter your {providerInfo.name} API credentials. StayLoop stores them securely and uses
                    them only to sync your account.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-gray-700">Account name</span>
                    <input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder={`Example: My ${providerInfo.name} Portfolio`}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-gray-700">Sync direction</span>
                    <select
                      value={connectDirection}
                      onChange={(e) => setConnectDirection(e.target.value as PMSSyncDirection)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    >
                      {(Object.keys(SYNC_DIRECTION_LABELS) as PMSSyncDirection[]).map((dir) => (
                        <option key={dir} value={dir}>
                          {SYNC_DIRECTION_LABELS[dir]}
                        </option>
                      ))}
                    </select>
                  </label>

                  {providerInfo.fields.map((field) => (
                    <label key={field.key} className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-semibold text-gray-700">
                        {field.label}
                        {field.optional ? ' (optional)' : ''}
                      </span>
                      <input
                        value={credentialValues[field.key] ?? ''}
                        onChange={(e) =>
                          setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        type={field.secret ? 'password' : 'text'}
                        required={!field.optional}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={resetConnectionForm}
                    className="rounded-xl border border-gray-300 px-5 py-3 font-semibold text-gray-700 transition hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !requiredFieldsFilled}
                    className="rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3 font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? 'Connecting...' : 'Save connection'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-300">
          <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Connections Yet</h3>
          <p className="text-gray-600 mb-6">
            Connect your property management system to start syncing data automatically
          </p>
          <button
            onClick={() => setShowAddConnection(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:shadow-xl transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            Add Your First Connection
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {connections.map((connection) => {
            const provider = pmsProviders.find((p) => p.id === connection.pms_provider);
            const logs = syncLogs[connection.id] || [];

            return (
              <div
                key={connection.id}
                className="bg-white rounded-3xl p-8 border-2 border-gray-200 shadow-lg"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-rose-100 rounded-2xl flex items-center justify-center">
                      <Settings className="w-8 h-8 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{provider?.name}</h3>
                      {connection.account_name && <p className="text-gray-600">{connection.account_name}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {connection.is_active ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-500 font-medium">Inactive</span>
                          </>
                        )}
                        {connection.last_sync_at && (
                          <span className="text-sm text-gray-500 ml-2">
                            Last synced: {new Date(connection.last_sync_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(connection.id, connection.is_active)}
                      className={`px-4 py-2 rounded-xl font-semibold transition ${
                        connection.is_active
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {connection.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(connection.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">Automatic sync</h4>
                        <p className="mt-1 text-sm text-gray-600">
                          Runs scheduled syncs and processes webhooks for this connection.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-3">
                        <span className="text-sm font-semibold text-gray-700">
                          {isPMSAutoSyncEnabled(connection) ? 'On' : 'Off'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isPMSAutoSyncEnabled(connection)}
                          onClick={() => handleAutoSyncToggle(connection)}
                          disabled={!connection.is_active}
                          className={`relative h-8 w-14 rounded-full transition ${
                            isPMSAutoSyncEnabled(connection) ? 'bg-orange-500' : 'bg-gray-300'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <span
                            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                              isPMSAutoSyncEnabled(connection) ? 'left-7' : 'left-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-5 w-5 text-orange-600" />
                      <h4 className="text-lg font-bold text-gray-900">Sync direction</h4>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Controls whether StayLoop bookings are pushed back to {provider?.name}.
                    </p>
                    <select
                      value={connection.sync_direction}
                      onChange={(e) =>
                        handleDirectionChange(connection, e.target.value as PMSSyncDirection)
                      }
                      disabled={!connection.is_active}
                      className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                    >
                      {(Object.keys(SYNC_DIRECTION_LABELS) as PMSSyncDirection[]).map((dir) => (
                        <option key={dir} value={dir}>
                          {SYNC_DIRECTION_LABELS[dir]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <p className="text-sm font-semibold text-gray-800">Webhook URL</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Add this in {provider?.name} so booking and calendar changes sync in real time.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <code className="flex-1 truncate rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                      {getPMSWebhookUrl(connection.id, connection.pms_provider) || 'Configure VITE_SUPABASE_URL'}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyWebhookUrl(connection)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Copy className="h-4 w-4" />
                      Copy URL
                    </button>
                  </div>
                </div>

                <div className="mb-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleSync(connection.id, 'properties')}
                    disabled={syncing === connection.id || !connection.is_active}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-5 h-5 ${syncing === connection.id ? 'animate-spin' : ''}`} />
                    Sync Properties
                  </button>
                  <button
                    onClick={() => handleSync(connection.id, 'bookings')}
                    disabled={syncing === connection.id || !connection.is_active}
                    className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Sync Bookings
                  </button>
                  <button
                    onClick={() => handleSync(connection.id, 'availability')}
                    disabled={syncing === connection.id || !connection.is_active}
                    className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-orange-200 text-orange-700 font-bold rounded-xl hover:bg-orange-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Sync Calendars
                  </button>
                  <button
                    onClick={() => handleSync(connection.id, 'all')}
                    disabled={syncing === connection.id || !connection.is_active}
                    className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-rose-200 text-rose-700 font-bold rounded-xl hover:bg-rose-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Sync All
                  </button>
                </div>

                {logs.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-4">Recent Sync History</h4>
                    <div className="space-y-2">
                      {logs.slice(0, 5).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {log.sync_type.charAt(0).toUpperCase() + log.sync_type.slice(1)} Sync
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  {log.sync_direction === 'to_pms' ? '→ PMS' : '← PMS'}
                                </span>
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(log.started_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-semibold text-gray-900">
                                {log.records_succeeded} / {log.records_processed}
                              </p>
                              <p className="text-xs text-gray-500">records synced</p>
                            </div>
                            {log.status === 'completed' ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : log.status === 'failed' ? (
                              <XCircle className="w-5 h-5 text-red-500" />
                            ) : (
                              <Clock className="w-5 h-5 text-yellow-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Universal iCal channel */}
      <div className="bg-white rounded-3xl p-8 border-2 border-gray-200 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <CalendarDays className="w-7 h-7 text-orange-600" />
          <h3 className="text-2xl font-extrabold text-gray-900">Calendar sync (iCal)</h3>
        </div>
        <p className="text-gray-600 mb-6">
          Works with any platform — Airbnb, VRBO, or any PMS. Share StayLoop's calendar out, and import
          external calendars in, to prevent double bookings.
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Download className="w-5 h-5 text-gray-500" />
              <h4 className="text-lg font-bold text-gray-900">Export StayLoop calendars</h4>
            </div>
            {properties.length === 0 ? (
              <p className="text-sm text-gray-500">You have no properties yet.</p>
            ) : (
              <div className="space-y-3">
                {properties.map((property) => (
                  <div key={property.id} className="rounded-xl border border-gray-200 p-4">
                    <p className="font-semibold text-gray-900">{property.title}</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <code className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        {getICalExportUrl(property) || 'Save the property to generate a URL'}
                      </code>
                      <button
                        onClick={() => copyExportUrl(property)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-bold text-gray-900">Import external calendars</h4>
              <button
                onClick={handleImportFeeds}
                disabled={importing || feeds.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${importing ? 'animate-spin' : ''}`} />
                Import now
              </button>
            </div>

            <form onSubmit={handleAddFeed} className="space-y-3 rounded-xl border border-gray-200 p-4">
              <select
                value={newFeedProperty}
                onChange={(e) => setNewFeedProperty(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
              >
                <option value="">Select property…</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.title}
                  </option>
                ))}
              </select>
              <input
                value={newFeedLabel}
                onChange={(e) => setNewFeedLabel(e.target.value)}
                placeholder="Label (e.g. Airbnb, VRBO)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <input
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="https://…/calendar.ics"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <button
                type="submit"
                disabled={!newFeedProperty || !newFeedUrl.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Add feed
              </button>
            </form>

            {feeds.length > 0 && (
              <div className="mt-4 space-y-2">
                {feeds.map((feed) => {
                  const property = properties.find((p) => p.id === feed.property_id);
                  return (
                    <div
                      key={feed.id}
                      className="flex items-center justify-between rounded-xl border border-gray-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {feed.label || 'Calendar feed'}
                          <span className="ml-2 font-normal text-gray-500">{property?.title}</span>
                        </p>
                        <p className="truncate text-xs text-gray-500">{feed.feed_url}</p>
                        {feed.last_import_status && (
                          <p
                            className={`text-xs ${
                              feed.last_import_status === 'success' ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {feed.last_import_status === 'success'
                              ? `Imported ${feed.last_event_count} blocked night(s)`
                              : `Failed: ${feed.last_import_error ?? 'unknown error'}`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteFeed(feed.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
