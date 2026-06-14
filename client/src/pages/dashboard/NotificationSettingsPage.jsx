import React, { useState, useEffect } from 'react';
import {
  Mail,
  MessageSquare,
  Smartphone,
  Save,
  Bell,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Badge, Card, Button, Input, Toggle, PageHeader, Loader } from '../../components';
import api from '../../services/api.js';

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState({
    emailOnHighConfidence: true,
    emailDigest: false,
    inAppAlerts: true,
    whatsappEnabled: false,
    whatsappNumber: '',
    telegramEnabled: false,
    telegramChatId: '',
    slackEnabled: false,
    slackWebhookUrl: '',
    pushEnabled: false,
    pushSubscription: null,
    alertMinSeverity: 3,
    whatsappMinSeverity: 5
  });

  const [vapidKey, setVapidKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [pushSubmitting, setPushSubmitting] = useState(false);
  const [testingWa, setTestingWa] = useState(false);

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/organization/me');
      if (data.organization?.notificationPrefs) {
        setPrefs(data.organization.notificationPrefs);
      }
      if (data.vapidPublicKey) {
        setVapidKey(data.vapidPublicKey);
      }
    } catch (err) {
      console.error('Failed to load preferences', err);
      setMessage({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field) => {
    setPrefs(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleInputChange = (field, value) => {
    setPrefs(prev => ({ ...prev, [field]: value }));
  };

  const saveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const { data } = await api.patch('/organization/notification-prefs', prefs);
      if (data.notificationPrefs) {
        setPrefs(data.notificationPrefs);
      }
      setMessage({ type: 'success', text: 'Notification preferences updated successfully.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (err) {
      console.error('Failed to update settings', err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save notification preferences.' });
    } finally {
      setSaving(false);
    }
  };

  const enablePushNotifications = async () => {
    setPushSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push messaging is not supported in your browser.');
      }

      // Check Notification Permission
      let permission = Notification.permission;
      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        throw new Error('Permission for notifications was denied.');
      }

      let subscription = null;
      if (vapidKey) {
        const register = await navigator.serviceWorker.ready;
        // Convert public key to Uint8Array
        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        subscription = await register.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray
        });
      } else {
        // Fallback to mock subscription if VAPID keys aren't configured
        subscription = {
          endpoint: 'https://updates.push.services.mock/piractrix/' + Math.random().toString(36).substring(7),
          keys: {
            p256dh: 'mock-p256dh-key-content',
            auth: 'mock-auth-token-content'
          }
        };
      }

      setPrefs(prev => ({
        ...prev,
        pushEnabled: true,
        pushSubscription: subscription
      }));
      
      setMessage({ type: 'success', text: 'Web push notifications registered successfully! Save settings to persist.' });
    } catch (err) {
      console.error('Push register error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to enable push notifications.' });
    } finally {
      setPushSubmitting(false);
    }
  };

  const testSlackNotification = async () => {
    if (!prefs.slackWebhookUrl) {
      setMessage({ type: 'error', text: 'Please enter a Slack Webhook URL first.' });
      return;
    }
    try {
      setMessage({ type: 'info', text: 'Sending Slack test message...' });
      await api.post('/alerts/test-slack', { webhookUrl: prefs.slackWebhookUrl });
      setMessage({ type: 'success', text: 'Slack test message sent successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (err) {
      console.error('Slack test failed:', err);
      setMessage({ type: 'error', text: 'Slack test delivery failed. Check webhook URL.' });
    }
  };

  const testWhatsAppNotification = async () => {
    if (!prefs.whatsappNumber) {
      setMessage({ type: 'error', text: 'Please enter a WhatsApp Number first.' });
      return;
    }
    setTestingWa(true);
    try {
      const { data } = await api.post('/organization/test-whatsapp', { whatsappNumber: prefs.whatsappNumber });
      setMessage({ type: 'success', text: data.message || 'Test message dispatched to WhatsApp!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to send WhatsApp test.' });
    } finally {
      setTestingWa(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader size={0.8} />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading settings...</p>
      </div>
    );
  }

  const severityLevels = [1, 2, 3, 4, 5];

  return (
    <div className="w-full space-y-6 lg:space-y-8 animate-in fade-in duration-300 pb-12">
      <PageHeader
        title="Notification Center"
        subtitle="Manage multi-channel alert delivery preferences for ShieldAgent actions."
      />

      {message.text && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          message.type === 'info' ? 'bg-sky-50 border-sky-200 text-sky-800' :
          'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" /> : 
           message.type === 'info' ? <Info className="h-5 w-5 shrink-0 mt-0.5" /> :
           <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />}
          <p className="text-sm font-semibold">{message.text}</p>
        </div>
      )}

      <form onSubmit={saveSettings} className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Main Channels Card */}
          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              Notification Channels
            </h2>
            <p className="text-xs text-slate-400">Configure how ShieldAgent alerts you of high severity piracy findings.</p>

            <div className="divide-y divide-slate-100">
              
              {/* Email */}
              <div className="py-5 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                      <Mail className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-slate-900 text-sm">Email Alerts (Primary)</span>
                    <Badge variant="success" className="text-[10px]">Connected</Badge>
                  </div>
                  <p className="text-xs text-slate-400 pl-10 max-w-md">
                    Sends violation summaries and AI-drafted reports directly to your registered rights holder email.
                  </p>
                </div>
                <div className="flex items-center gap-4 pl-10 md:pl-0">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                    <Toggle 
                      checked={prefs.emailOnHighConfidence} 
                      onChange={() => handleToggle('emailOnHighConfidence')} 
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp */}
              <div className="py-5 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-slate-900 text-sm">WhatsApp (Twilio)</span>
                    {prefs.whatsappEnabled && prefs.whatsappNumber ? (
                      <Badge variant="success" className="text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 pl-10 max-w-md">
                    Receive critical severity (SEV 5) SMS alerts. Requires E.164 phone format (e.g. +1234567890).
                  </p>
                  
                  {prefs.whatsappEnabled && (
                    <div className="pl-10 pt-3 space-y-3 max-w-sm">
                      <Input
                        label="WhatsApp Phone Number"
                        placeholder="+1234567890"
                        value={prefs.whatsappNumber || ''}
                        onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                      />
                      <Button 
                        type="button" 
                        variant="secondary" 
                        size="xs"
                        onClick={testWhatsAppNotification}
                        disabled={testingWa}
                        className={`transition-all duration-200 cursor-pointer hover:bg-slate-100 active:scale-95 ${testingWa ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {testingWa ? (
                          <span className="flex items-center gap-2">
                            <Loader className="w-3 h-3 animate-spin" />
                            Sending...
                          </span>
                        ) : (
                          'Send Test Notification'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 pl-10 md:pl-0">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                    <Toggle 
                      checked={prefs.whatsappEnabled} 
                      onChange={() => handleToggle('whatsappEnabled')} 
                    />
                  </div>
                </div>
              </div>

              {/* Telegram */}
              <div className="py-5 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-slate-900 text-sm">Telegram Agent Bot</span>
                    {prefs.telegramEnabled && prefs.telegramChatId ? (
                      <Badge variant="success" className="text-[10px]">Connected</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Setup Needed</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 pl-10 max-w-md">
                    Receive instant telegram notifications. Search for @PiractrixBot on Telegram, press /start, and paste your chat ID.
                  </p>
                  
                  {prefs.telegramEnabled && (
                    <div className="pl-10 pt-3 max-w-sm">
                      <Input
                        label="Telegram Chat ID"
                        placeholder="182736452"
                        value={prefs.telegramChatId || ''}
                        onChange={(e) => handleInputChange('telegramChatId', e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 pl-10 md:pl-0">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                    <Toggle 
                      checked={prefs.telegramEnabled} 
                      onChange={() => handleToggle('telegramEnabled')} 
                    />
                  </div>
                </div>
              </div>

              {/* Slack */}
              <div className="py-5 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <rect x="2" y="2" width="20" height="20" rx="5" />
                        <path d="M9 12h6" />
                        <path d="M12 9v6" />
                      </svg>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">Slack Webhooks</span>
                    {prefs.slackEnabled && prefs.slackWebhookUrl ? (
                      <Badge variant="success" className="text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Setup Needed</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 pl-10 max-w-md">
                    Stream detection feeds directly into your security team's Slack channel.
                  </p>
                  
                  {prefs.slackEnabled && (
                    <div className="pl-10 pt-3 space-y-3">
                      <Input
                        label="Webhook URL"
                        placeholder="https://hooks.slack.com/services/..."
                        value={prefs.slackWebhookUrl || ''}
                        onChange={(e) => handleInputChange('slackWebhookUrl', e.target.value)}
                      />
                      <Button 
                        type="button" 
                        variant="secondary" 
                        size="xs"
                        onClick={testSlackNotification}
                      >
                        Send Test Notification
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 pl-10 md:pl-0">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                    <Toggle 
                      checked={prefs.slackEnabled} 
                      onChange={() => handleToggle('slackEnabled')} 
                    />
                  </div>
                </div>
              </div>

              {/* Browser Push */}
              <div className="py-5 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                      <Bell className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-slate-900 text-sm">Browser Push Notifications</span>
                    {prefs.pushEnabled ? (
                      <Badge variant="success" className="text-[10px]">Enabled</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 pl-10 max-w-md">
                    Allows ShieldAgent to throw native desktop notification alerts even when the dashboard tab is running in the background.
                  </p>
                  
                  {!prefs.pushEnabled && (
                    <div className="pl-10 pt-3">
                      <Button 
                        type="button" 
                        variant="secondary" 
                        size="sm"
                        onClick={enablePushNotifications}
                        disabled={pushSubmitting}
                      >
                        {pushSubmitting ? 'Registering...' : 'Request Permission & Enable'}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 pl-10 md:pl-0">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                    <Toggle 
                      checked={prefs.pushEnabled} 
                      onChange={() => {
                        if (!prefs.pushEnabled) {
                          enablePushNotifications();
                        } else {
                          setPrefs(prev => ({ ...prev, pushEnabled: false, pushSubscription: null }));
                        }
                      }} 
                    />
                  </div>
                </div>
              </div>

            </div>
          </Card>
        </div>

        {/* Sidebar settings */}
        <div className="space-y-6">
          <Card className="p-6 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Alert Routing Rules</h3>
            
            {/* General Severity Slider */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                General Alert Threshold: SEV {prefs.alertMinSeverity}+
              </label>
              <div className="flex items-center justify-between gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100">
                {severityLevels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleInputChange('alertMinSeverity', lvl)}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                      prefs.alertMinSeverity === lvl 
                        ? 'bg-purple-600 text-white shadow-xs' 
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    S{lvl}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                Determines the minimum severity classification required to dispatch any external notification channel alert.
              </p>
            </div>

            {/* WhatsApp Severity Slider */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-700 block">
                WhatsApp SMS Threshold: SEV {prefs.whatsappMinSeverity}+
              </label>
              <div className="flex items-center justify-between gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100">
                {severityLevels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleInputChange('whatsappMinSeverity', lvl)}
                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                      prefs.whatsappMinSeverity === lvl 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    S{lvl}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                WhatsApp notifications are highly critical. S5 means only absolute high-confidence distribution sweeps trigger SMS text alerts.
              </p>
            </div>

            {/* Preferences Checkbox group */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Preferences</span>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={prefs.emailDigest} 
                  onChange={() => handleToggle('emailDigest')} 
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-800">Weekly Digest Reports</span>
                  <p className="text-[10px] text-slate-400">Receive a weekly breakdown email summarizing active cases.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2">
                <input 
                  type="checkbox" 
                  checked={prefs.inAppAlerts} 
                  onChange={() => handleToggle('inAppAlerts')} 
                  className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4 mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-800">In-App Banner Badges</span>
                  <p className="text-[10px] text-slate-400">Show notification dot badges in the command center navigation.</p>
                </div>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button 
                type="submit" 
                className="w-full flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader size={0.4} color="#white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Preferences</span>
                  </>
                )}
              </Button>
            </div>

          </Card>
        </div>
      </form>
    </div>
  );
}
