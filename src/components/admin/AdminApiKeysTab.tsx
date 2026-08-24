import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Save,
  Check,
  ExternalLink,
  Cpu,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { AdminApiKeyConfig } from '../../types';
import { testAdminKeyApi, saveAdminKeysApi, revealAdminKeyApi } from '../../services/api';

interface AdminApiKeysTabProps {
  keys: AdminApiKeyConfig[];
  isLoading: boolean;
  onRefreshKeys: () => void;
  onSaveKeys: (updatedKeys: AdminApiKeyConfig[]) => Promise<void>;
}

export const AdminApiKeysTab: React.FC<AdminApiKeysTabProps> = ({
  keys,
  isLoading,
  onRefreshKeys,
  onSaveKeys,
}) => {
  const [keyList, setKeyList] = useState<AdminApiKeyConfig[]>(keys);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Add Key Form
  const [newKeyString, setNewKeyString] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Testing states
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [isTestingAll, setIsTestingAll] = useState(false);

  // Revealed keys cache
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [revealingKeyId, setRevealingKeyId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const toggleRevealKey = async (id: string) => {
    if (revealedKeys[id]) {
      const next = { ...revealedKeys };
      delete next[id];
      setRevealedKeys(next);
      return;
    }

    // Check if key_full is already stored locally
    const existing = keyList.find((k) => k.id === id);
    if (existing?.key_full) {
      setRevealedKeys((prev) => ({ ...prev, [id]: existing.key_full! }));
      return;
    }

    try {
      setRevealingKeyId(id);
      const rawKey = await revealAdminKeyApi(id);
      setRevealedKeys((prev) => ({ ...prev, [id]: rawKey }));
    } catch (err: any) {
      alert(err.message || 'কী আনমাস্ক করতে ব্যর্থ হয়েছে');
    } finally {
      setRevealingKeyId(null);
    }
  };

  const handleCopyKey = (id: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Synchronize when incoming props change
  React.useEffect(() => {
    setKeyList(keys);
  }, [keys]);

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyString.trim()) return;

    const trimmedKey = newKeyString.trim();
    const newEntry: AdminApiKeyConfig = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      provider: 'openrouter',
      label: newKeyLabel.trim() || `OpenRouter Key ${keyList.length + 1}`,
      key_masked: `${trimmedKey.slice(0, 10)}...${trimmedKey.slice(-4)}`,
      key_full: trimmedKey,
      status: 'untested',
      error_count: 0,
      success_count: 0,
      created_at: new Date().toISOString(),
    };

    setKeyList([...keyList, newEntry]);
    setNewKeyString('');
    setNewKeyLabel('');
    setIsAdding(false);
  };

  const handleDeleteKey = (id: string) => {
    if (!window.confirm('আপনি কি এই এপিআই কী-টি তালিকা থেকে মুছে ফেলতে চান?')) return;
    setKeyList(keyList.filter((k) => k.id !== id));
  };

  const handleTestSingleKey = async (keyItem: AdminApiKeyConfig) => {
    setTestingKeyId(keyItem.id);
    try {
      const res = await testAdminKeyApi({
        key: keyItem.key_full || undefined,
        id: keyItem.id,
      });

      setKeyList((prev) =>
        prev.map((k) => {
          if (k.id === keyItem.id) {
            return {
              ...k,
              status: res.status,
              latency_ms: res.latencyMs,
              last_checked_at: new Date().toISOString(),
              error_count: res.success ? k.error_count : (k.error_count || 0) + 1,
              success_count: res.success ? (k.success_count || 0) + 1 : k.success_count,
            };
          }
          return k;
        })
      );
    } catch (err) {
      console.error('Test key error:', err);
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleTestAllKeys = async () => {
    setIsTestingAll(true);
    try {
      for (const k of keyList) {
        await handleTestSingleKey(k);
      }
    } finally {
      setIsTestingAll(false);
    }
  };

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    setSaveSuccess('');
    setSaveError('');

    try {
      await onSaveKeys(keyList);
      setSaveSuccess('এপিআই কী কনফিগারেশন সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
            <Cpu className="w-3.5 h-3.5" />
            রোবাস্ট এআই ফলব্যাক সিস্টেম
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            ওপেনরাউটার মাল্টি-কি ও অটো-ফেইলওভার সেন্টার
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
            একাধিক OpenRouter API Key কনফিগার করে রাখুন। কোনো কি লিমিট (429) অতিক্রম করলে বা এরর পেলে সিস্টেম স্বয়ংক্রিয়ভাবে পরবর্তী কি-তে চলে যায়।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestAllKeys}
            disabled={isTestingAll || keyList.length === 0}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-500 ${isTestingAll ? 'animate-bounce' : ''}`} />
            {isTestingAll ? 'টেস্টিং চলছে...' : 'সবগুলো টেস্ট করুন'}
          </button>

          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            নতুন কী যুক্ত করুন
          </button>
        </div>
      </div>

      {/* Save Notification */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Add New Key Form Card */}
      {isAdding && (
        <form
          onSubmit={handleAddKey}
          className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" />
              নতুন OpenRouter API Key যোগ করুন
            </h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              বাতিল
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">কী এর নাম বা লেবেল</label>
              <input
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="e.g. Free Backup Key 1"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                OpenRouter Secret Key (sk-or-v1-...)
              </label>
              <input
                type="password"
                value={newKeyString}
                onChange={(e) => setNewKeyString(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxx"
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
            >
              তালিকায় যুক্ত করুন
            </button>
          </div>
        </form>
      )}

      {/* Keys Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            কনফিগার করা এপিআই কী তালিকা ({keyList.length})
          </div>
          <span className="text-xs text-slate-500">অগ্রাধিকার ক্রম: ১ থেকে শুরু করে ক্রমান্বয়ে ফলব্যাক</span>
        </div>

        {keyList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <Key className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold">কোনো কাস্টম এপিআই কী নেই</p>
            <p className="text-xs text-slate-400">
              ডিফল্ট পরিবেশ ভেরিয়েবল (OPENROUTER_API_KEY) থেকে কী ব্যবহৃত হচ্ছে।
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {keyList.map((keyItem, index) => {
              const isTesting = testingKeyId === keyItem.id;
              return (
                <div
                  key={keyItem.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      #{index + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{keyItem.label}</span>
                        {/* Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            keyItem.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : keyItem.status === 'rate_limited'
                              ? 'bg-amber-100 text-amber-800'
                              : keyItem.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {keyItem.status === 'active' && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              সক্রিয় (Active)
                            </>
                          )}
                          {keyItem.status === 'rate_limited' && (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              রেট লিমিটেড (429)
                            </>
                          )}
                          {keyItem.status === 'error' && (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              ত্রুটি (Error)
                            </>
                          )}
                          {keyItem.status === 'untested' && 'টেস্ট করা হয়নি'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                          <span className="font-mono text-slate-700 select-all">
                            {revealedKeys[keyItem.id] || keyItem.key_masked}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleRevealKey(keyItem.id)}
                            disabled={revealingKeyId === keyItem.id}
                            title={revealedKeys[keyItem.id] ? 'কী লুকান' : 'সম্পূর্ণ কী দেখুন'}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          >
                            {revealingKeyId === keyItem.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                            ) : revealedKeys[keyItem.id] ? (
                              <EyeOff className="w-3 h-3 text-indigo-600" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                          {revealedKeys[keyItem.id] && (
                            <button
                              type="button"
                              onClick={() => handleCopyKey(keyItem.id, revealedKeys[keyItem.id])}
                              title="কী কপি করুন"
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                              {copiedKeyId === keyItem.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>

                        {keyItem.latency_ms && (
                          <span className="text-indigo-600 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {keyItem.latency_ms}ms
                          </span>
                        )}
                        {keyItem.success_count !== undefined && (
                          <span>সফল রিকোয়েস্ট: {keyItem.success_count}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleTestSingleKey(keyItem)}
                      disabled={isTesting}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-white flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      {isTesting ? 'চেক হচ্ছে...' : 'পিং টেস্ট'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteKey(keyItem.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer with Save to Database Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            পরিবর্তনগুলো স্থায়ীভাবে সংরক্ষণ করতে নিচের বাটনে চাপুন
          </span>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
          </button>
        </div>
      </div>

      {/* Failover Guide Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          স্মার্ট ফেইলওভার ও ফ্রি টিয়ার অপটিমাইজেশন
        </h3>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          ওপেনরাউটারের ফ্রি মডেলগুলো (যেমন <code className="text-indigo-300">openrouter/free</code>, <code className="text-indigo-300">nvidia/llama-3.1-nemotron-70b-instruct:free</code>) অনেক সময় অতিরিক্ত ট্রাফিকের কারণে রেট লিমিট দেয়। একাধিক কি যুক্ত থাকলে PrepTest সিস্টেম নিজে নিজেই পরবর্তী কি-তে প্রশ্ন জেনারেট করে নেয়, যাতে শিক্ষার্থীদের পড়ালেখায় কোনো ব্যাঘাত না ঘটে।
        </p>
      </div>
    </div>
  );
};
