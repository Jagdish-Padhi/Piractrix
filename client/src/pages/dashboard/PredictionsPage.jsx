import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  AlertOctagon,
  Percent,
  Calendar,
  Zap,
  HelpCircle,
  BarChart,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { Card, Button, Input, PageHeader, Loader } from '../../components';
import api from '../../services/api.js';

export default function PredictionsPage() {
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  
  // Input fields
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [customEventName, setCustomEventName] = useState('');
  const [broadcastTime, setBroadcastTime] = useState('Tonight at 8:00 PM');
  
  // Dynamic Simulator inputs
  const [viewershipScale, setViewershipScale] = useState(1); // 1 = 1x default, 0.5 = low, 5 = massive
  const [autoBlockSpeed, setAutoBlockSpeed] = useState(30); // minutes

  // Output prediction
  const [predictionData, setPredictionData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      setLoadingAssets(true);
      const res = await api.get('/assets?page=1&limit=100');
      const fetchedAssets = res.data.items || [];
      setAssets(fetchedAssets);
      if (fetchedAssets.length > 0) {
        setSelectedAssetId(fetchedAssets[0]._id);
      }
    } catch (err) {
      console.warn('Failed to load assets for predictions', err);
    } finally {
      setLoadingAssets(false);
    }
  };

  const generateForecast = async (e) => {
    if (e) e.preventDefault();
    setGenerating(true);
    setError('');
    
    const assetObj = assets.find(a => a._id === selectedAssetId);
    const eventName = customEventName || (assetObj ? assetObj.title : 'Live Broadcast');

    try {
      const { data } = await api.get('/agent/predict', {
        params: {
          assetId: selectedAssetId,
          eventName,
          broadcastTime
        }
      });
      setPredictionData(data);
    } catch (err) {
      console.error('Failed to get predictions', err);
      setError('Piractrix Intelligence prediction engine timed out. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Dynamic simulation calculations
  const getSimulatedMetrics = () => {
    if (!predictionData?.prediction) return null;
    const baseViolations = predictionData.prediction.expectedViolations || 25;
    
    // Scale violations by viewership factor
    const violations = Math.round(baseViolations * viewershipScale);
    
    // Calculate expected damage saved based on block speed
    // If block speed is 5 mins, we save 95% of damages. If 60 mins, we save only 30% of damages.
    const efficiency = Math.max(10, Math.min(98, 100 - (autoBlockSpeed * 1.2)));
    const leaksStopped = Math.round(violations * (efficiency / 100));
    
    return {
      violations,
      efficiency: Math.round(efficiency),
      leaksStopped,
      potentialReachLoss: Math.round(violations * 1420 * (1 - efficiency / 100)) // arbitrary impact calculation
    };
  };

  const simMetrics = getSimulatedMetrics();

  return (
    <div className="w-full space-y-6 lg:space-y-8 animate-in fade-in duration-300 pb-12">
      <PageHeader
        title="Piracy Predictions"
        subtitle="Leverage predictive threat models to forecast stream leaks before they broadcast."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Forecast Setup */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Forecast Generator
            </h2>
            <form onSubmit={generateForecast} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Select Asset to Protect</label>
                {loadingAssets ? (
                  <div className="py-2 text-xs text-slate-400">Loading assets...</div>
                ) : (
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-purple-500 transition-colors"
                  >
                    {assets.map((asset) => (
                      <option key={asset._id} value={asset._id}>
                        {asset.title} ({asset.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Custom Event Title (Optional)</label>
                <Input
                  placeholder="e.g. Champions League Final Live"
                  value={customEventName}
                  onChange={(e) => setCustomEventName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Broadcast Time window</label>
                <Input
                  placeholder="e.g. Tonight at 8:00 PM EST"
                  value={broadcastTime}
                  onChange={(e) => setBroadcastTime(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2 shadow-xs"
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader size={0.4} color="white" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-white text-white" />
                    <span>Generate Threat Forecast</span>
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Interactive Simulation Controls */}
          {predictionData && (
            <Card className="p-6 space-y-5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">Defense Simulator</h3>
                <p className="text-[10px] text-slate-400">Test how response times and event scales modify piracy risk.</p>
              </div>

              {/* Viewership Scale slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Broadcast Viewership Scale</span>
                  <span className="font-bold text-purple-600">x{viewershipScale.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={viewershipScale}
                  onChange={(e) => setViewershipScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>Regional Match (0.5x)</span>
                  <span>Mega Event (10.0x)</span>
                </div>
              </div>

              {/* Auto Block Speed slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Agent Response Sweep Interval</span>
                  <span className="font-bold text-emerald-600">{autoBlockSpeed} mins</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={autoBlockSpeed}
                  onChange={(e) => setAutoBlockSpeed(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                  <span>Autonomous (5 mins)</span>
                  <span>Manual (120 mins)</span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Prediction Results Display */}
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm font-semibold text-rose-800 flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!predictionData ? (
            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center space-y-4 bg-slate-50/50 flex flex-col items-center justify-center min-h-[400px]">
              <div className="p-4 rounded-full bg-slate-100/80 text-slate-400">
                <Activity className="h-10 w-10 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Awaiting Simulation Parameters</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Select an asset and enter event details to trigger Piractrix Intelligence's zero-day predictive model.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Key Metrics Dashboard */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                
                {/* Expected Violations */}
                <div className="rounded-xl bg-white border border-slate-200 border-t-[3px] border-t-purple-500 p-5 flex flex-col justify-center min-h-[120px] shadow-xs">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">
                    {simMetrics ? simMetrics.violations : (predictionData.prediction?.expectedViolations || 0)}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                    Expected active stream leaks forecasted for this event
                  </span>
                </div>

                {/* Peak Hour */}
                <div className="rounded-xl bg-white border border-slate-200 border-t-[3px] border-t-orange-500 p-5 flex flex-col justify-center min-h-[120px] shadow-xs">
                  <span className="text-2xl font-black text-slate-900 tracking-tight">
                    {predictionData.prediction?.peakHour || 'Unknown'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                    Estimated peak threat hour measured from broadcast start
                  </span>
                </div>

                {/* Risk Level */}
                <div className="rounded-xl bg-white border border-slate-200 border-t-[3px] border-t-rose-500 p-5 flex flex-col justify-center min-h-[120px] shadow-xs">
                  <span className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                    {predictionData.prediction?.riskLevel || 'Unknown'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                    Calculated risk severity based on platform distribution
                  </span>
                </div>

                {/* Confidence */}
                <div className="rounded-xl bg-white border border-slate-200 border-t-[3px] border-t-emerald-500 p-5 flex flex-col justify-center min-h-[120px] shadow-xs">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">
                    {predictionData.prediction?.confidence || '0%'}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
                    Predictive engine confidence score for intelligence data
                  </span>
                </div>

              </div>

              {/* Platform Distribution Card */}
              <Card className="p-6 space-y-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Forecasted Platform Distribution</h3>
                <div className="space-y-4">
                  {(predictionData.prediction.topPlatforms || []).map((platformStr, idx) => {
                    const match = platformStr.match(/^(.*?)\s*\((\d+)%\)$/);
                    const name = match ? match[1] : platformStr;
                    const val = match ? parseInt(match[2]) : (35 - idx * 10);
                    
                    const barColors = [
                      'bg-red-500', // youtube
                      'bg-sky-500', // telegram/twitter
                      'bg-purple-500', // web
                      'bg-emerald-500'
                    ];

                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-slate-700">
                          <span>{name}</span>
                          <span>{val}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${barColors[idx % barColors.length]} rounded-full transition-all duration-1000`} 
                            style={{ width: `${val}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Piractrix Intelligence Analytics Explainer */}
              <Card className="p-6 bg-slate-900 border-none text-slate-100 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                  <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-violet-400">Predictive Threat Analysis</span>
                </div>
                <p className="text-sm leading-relaxed text-slate-300 font-mono">
                  {predictionData.prediction?.reasoning || 'No analysis available.'}
                </p>
                <div className="pt-2 flex justify-between items-center text-[10px] font-mono text-slate-500">
                  <span>Model: Predictive Analysis Engine</span>
                  <span>Generated At: {new Date(predictionData.generatedAt).toLocaleTimeString()}</span>
                </div>
              </Card>

              {/* Dynamic Simulator Output Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-5 space-y-2 bg-emerald-50/50 border-emerald-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Agent Mitigated Leaks</span>
                  <div className="text-3xl font-black text-emerald-800">{simMetrics?.leaksStopped}</div>
                  <p className="text-[10px] text-emerald-600">takedown drafts issued automatically</p>
                </Card>

                <Card className="p-5 space-y-2 bg-purple-50/50 border-purple-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block">Mitigation Efficiency</span>
                  <div className="text-3xl font-black text-purple-800">{simMetrics?.efficiency}%</div>
                  <p className="text-[10px] text-purple-600">estimated copyright retention rating</p>
                </Card>

                <Card className="p-5 space-y-2 bg-rose-50/50 border-rose-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">Estimated Audience Leak</span>
                  <div className="text-3xl font-black text-rose-800">{simMetrics?.potentialReachLoss}</div>
                  <p className="text-[10px] text-rose-600">unmitigated viewers reach count</p>
                </Card>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
