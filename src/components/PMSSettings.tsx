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
} from 'lucide-react';
import {
  pmsProviders,
  createPMSConnection,
  getPMSConnections,
  syncPMSProperties,
  syncPMSBookings,
  syncAllPMS,
  syncAllPMSAvailability,
  getPMSWebhookUrl,
  isPMSAutoSyncEnabled,
  setPMSAutoSync,
  getSyncLogs,
  deletePMSConnection,
  togglePMSConnection,
  type PMSConnection,
  type PMSSyncLog,
  type PMSProvider,
} from '../lib/pms';

export default function PMSSettings() {
  const [connections, setConnections] = useState<PMSConnection[]>([]);
  const [syncLogs, setSyncLogs] = useState<Record<string, PMSSyncLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<PMSProvider | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await getPMSConnections();
      setConnections(data);

      for (const conn of data) {
        const logs = await getSyncLogs(conn.id, 10);
        setSyncLogs(prev => ({ ...prev, [conn.id]: logs }));
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
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
        alert(`Calendar sync finished: ${result.succeeded}/${result.processed} properties updated.`);
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

  const copyWebhookUrl = async (connection: PMSConnection) => {
    const url = getPMSWebhookUrl(connection.id, connection.pms_provider);
    if (!url) {
      alert('Webhook URL is unavailable. Check VITE_SUPABASE_URL in your deployment.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      alert('Webhook URL copied. Paste it in OwnerRez → Settings → Webhooks.');
    } catch {
      prompt('Copy this webhook URL into OwnerRez:', url);
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
    if (!confirm('Are you sure you want to remove this connection? All synced data will remain, but automatic sync will stop.')) {
      return;
    }

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
    setAccessToken('');
    setRefreshToken('');
  };

  const handleCreateConnection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProvider || !accessToken.trim()) return;

    setCreating(true);
    try {
      await createPMSConnection(
        selectedProvider,
        accessToken.trim(),
        refreshToken.trim() || undefined,
        accountName.trim() || undefined
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">PMS Integrations</h2>
          <p className="text-gray-600 mt-2">Connect your Property Management System to sync properties and bookings</p>
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
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pmsProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="border-2 border-gray-200 rounded-2xl p-6 hover:border-orange-300 transition-all duration-300"
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
                      View Setup Guide
                    </a>
                    <button
                      onClick={() => setSelectedProvider(provider.id)}
                      className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:shadow-lg transition"
                    >
                      Connect {provider.name}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selectedProvider && (
              <form onSubmit={handleCreateConnection} className="mt-8 rounded-2xl border-2 border-orange-200 bg-orange-50/60 p-6">
                <div className="mb-5">
                  <h4 className="text-xl font-bold text-gray-900">
                    Connect {pmsProviders.find(provider => provider.id === selectedProvider)?.name}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Paste your PMS API/OAuth access token to create a connection. For OwnerRez, request API access in OwnerRez and use the token provided for your account.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-gray-700">Account name</span>
                    <input
                      value={accountName}
                      onChange={(event) => setAccountName(event.target.value)}
                      placeholder="Example: Paul OwnerRez Portfolio"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-gray-700">Access token</span>
                    <input
                      value={accessToken}
                      onChange={(event) => setAccessToken(event.target.value)}
                      placeholder="Paste API/OAuth token"
                      type="password"
                      required
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-gray-700">Refresh token (optional)</span>
                    <input
                      value={refreshToken}
                      onChange={(event) => setRefreshToken(event.target.value)}
                      placeholder="Paste refresh token if OwnerRez provides one"
                      type="password"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
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
                    disabled={creating || !accessToken.trim()}
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
            const provider = pmsProviders.find(p => p.id === connection.pms_provider);
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
                      {connection.account_name && (
                        <p className="text-gray-600">{connection.account_name}</p>
                      )}
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

                <div className="mb-6 rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Automatic sync</h4>
                      <p className="mt-1 text-sm text-gray-600">
                        When enabled, StayLoop runs scheduled syncs and processes OwnerRez webhooks for this
                        connection.
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

                  {connection.pms_provider === 'ownerrez' && (
                    <div className="mt-4 border-t border-orange-100 pt-4">
                      <p className="text-sm font-semibold text-gray-800">OwnerRez webhook URL</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Add this URL in OwnerRez so booking and calendar changes sync without clicking Sync.
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
                  )}
                </div>

                <div className="mb-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleSync(connection.id, 'properties')}
                    disabled={syncing === connection.id || !connection.is_active}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncing === connection.id ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-5 h-5" />
                    )}
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
    </div>
  );
}
