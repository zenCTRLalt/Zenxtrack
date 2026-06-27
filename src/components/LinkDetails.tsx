import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { TrackingLink, VisitRecord } from '../types';
import { 
  MapPin, Clock, Smartphone, Globe2, Sparkles, Navigation, Trash2, 
  ChevronRight, ExternalLink, Activity, Layers, Compass, HelpCircle, ArrowUpRight,
  QrCode, Download
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';

interface LinkDetailsProps {
  link: TrackingLink;
  onBack: () => void;
  onDeleted: () => void;
}

export default function LinkDetails({ link, onBack, onDeleted }: LinkDetailsProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Formulate active shareable url
  const baseMainPath = window.location.origin + window.location.pathname;
  const trackerUrl = `${baseMainPath}?t=${link.id}`;

  useEffect(() => {
    if (trackerUrl) {
      QRCode.toDataURL(trackerUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff'
        }
      })
        .then(url => {
          setQrCodeUrl(url);
        })
        .catch(err => {
          console.error("Failed to generate QR Code:", err);
        });
    }
  }, [trackerUrl]);

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `qr_${link.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'tracker'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    setLoading(true);
    // Realtime snapshot listener of visits nested in links/{linkId}/visits
    const visitsCollectionRef = collection(db, 'links', link.id, 'visits');
    const q = query(visitsCollectionRef, orderBy('timestamp', 'desc'), limit(150));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: VisitRecord[] = [];
      snapshot.forEach((dt) => {
        const val = dt.data();
        records.push({
          id: dt.id,
          linkId: val.linkId,
          timestamp: val.timestamp?.toDate() || new Date(),
          ip: val.ip,
          country: val.country,
          region: val.region,
          city: val.city,
          latitude: val.latitude,
          longitude: val.longitude,
          accuracy: val.accuracy,
          userAgent: val.userAgent,
          method: val.method,
        });
      });
      setVisits(records);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, `links/${link.id}/visits`);
    });

    return () => unsubscribe();
  }, [link.id]);

  // Handle deletion safely
  const handleDeleteLink = async () => {
    try {
      const linkDocRef = doc(db, 'links', link.id);
      await deleteDoc(linkDocRef);
      onDeleted();
    } catch (err) {
      console.error("Failed to delete link resource: ", err);
      handleFirestoreError(err, OperationType.DELETE, `links/${link.id}`);
    }
  };

  // Helper Copy Tracker Path
  const copyLinkPath = () => {
    navigator.clipboard.writeText(trackerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Process chart data (clicks over time)
  const getTimelineData = () => {
    const visitsByDay: { [key: string]: number } = {};
    // Seed the last 7 days to ensure there are always chart indices
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      visitsByDay[label] = 0;
    }

    visits.forEach((v) => {
      const dateLabel = new Date(v.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (visitsByDay[dateLabel] !== undefined) {
        visitsByDay[dateLabel]++;
      } else {
        visitsByDay[dateLabel] = 1;
      }
    });

    return Object.keys(visitsByDay).map(day => ({
      day,
      clicks: visitsByDay[day]
    }));
  };

  // 2. Process Capture Method Ratio (GPS vs IP)
  const getMethodData = () => {
    let gps = 0;
    let ip = 0;
    visits.forEach(v => {
      if (v.method === 'gps') gps++;
      else ip++;
    });

    if (gps === 0 && ip === 0) return [];
    return [
      { name: 'Target Pinpoint (GPS)', value: gps, color: '#4f46e5' },
      { name: 'Network Estimated (IP)', value: ip, color: '#9ca3af' }
    ];
  };

  // 3. Process Geographical breakdown
  const getTopCities = () => {
    const counts: { [key: string]: { city: string, country: string, total: number } } = {};
    visits.forEach((v) => {
      const key = `${v.city}, ${v.country}`;
      if (counts[key]) counts[key].total++;
      else counts[key] = { city: v.city, country: v.country, total: 1 };
    });

    return Object.values(counts)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  };

  const timelineData = getTimelineData();
  const methodData = getMethodData();
  const topCities = getTopCities();

  const gpsRate = visits.length 
    ? Math.round((visits.filter(v => v.method === 'gps').length / visits.length) * 100) 
    : 0;

  return (
    <div className="space-y-8 pb-16">
      {/* Back Header navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/45">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors flex items-center gap-1 cursor-pointer"
            >
              ← Back to Campaign Stream
            </button>
          </div>
          <h1 className="text-xl font-extrabold text-gray-950 tracking-tight mt-1 flex items-center gap-2">
            <span>{link.title}</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 rounded">
              ID: {link.id}
            </span>
          </h1>
          <p className="text-xs text-gray-400 max-w-xl truncate">
            Redirecting target: <a href={link.destinationUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center gap-0.5">{link.destinationUrl} <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-1.5 bg-gray-50 border border-gray-250/70 rounded-xl flex items-center gap-2 text-xs font-sans">
            <input 
              type="text" 
              readOnly 
              value={trackerUrl} 
              className="w-48 bg-transparent focus:outline-none font-mono text-gray-600 truncate select-all"
            />
            <button 
              onClick={copyLinkPath} 
              className="text-indigo-600 hover:text-indigo-800 font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              {copied ? 'Copied' : 'Copy Tracker'}
            </button>
          </div>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="p-2 bg-red-50 hover:bg-red-100 text-red-650 border border-red-100 rounded-xl transition-all cursor-pointer"
              title="Delete Link"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDeleteLink}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition-all cursor-pointer"
              >
                Confirm Delete!
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-250 text-gray-600 font-semibold text-xs rounded-lg transition-all cursor-pointer border border-gray-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Summary Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Clicks Captured</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5 tracking-tight">{visits.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Navigation className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">GPS Verification Success</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5 tracking-tight">{visits.filter(v => v.method === 'gps').length} <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-1">{gpsRate}%</span></p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Country Jurisdictions</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5 tracking-tight">
              {new Set(visits.map(v => v.country)).size}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Visualizers (Charts & Geographical cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Click timeline Line Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-950">Clicks Activity Trend</h3>
              <p className="text-xs text-gray-400">Total hits verified over the active tracking lifecycle.</p>
            </div>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>

          <div className="h-64">
            {visits.length === 0 ? (
              <div className="h-full flex items-center justify-center border border-dashed border-gray-150 rounded-xl text-xs text-gray-400 font-mono">
                No telemetry activity logged yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ background: '#111827', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="#4f46e5" 
                    strokeWidth={2.5} 
                    dot={{ r: 4, strokeWidth: 0, fill: '#4f46e5' }}
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Sidebar: Location Handshake & QR Toolkit */}
        <div className="space-y-6">
          {/* Capture Ratio Pie Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-950">Location Capture Handshake</h3>
                <p className="text-xs text-gray-400">Ratio of precise coordinates against fallback estimation.</p>
              </div>
              <Compass className="w-4 h-4 text-purple-500" />
            </div>

            <div className="h-56 relative flex justify-center items-center">
              {methodData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center border border-dashed border-gray-150 rounded-xl text-xs text-gray-400 font-mono">
                  Telemetry pending.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {methodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend 
                      verticalAlign="bottom" 
                      align="center"
                      iconType="circle"
                      formatter={(name) => <span className="text-xs text-gray-600 font-semibold">{name}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Campaign QR Toolkit */}
          {qrCodeUrl && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 flex flex-col items-center text-center space-y-4">
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-950 text-left">Print Media QR Code</h3>
                </div>
                <button
                  onClick={downloadQRCode}
                  className="p-1.5 hover:bg-gray-50 text-gray-500 hover:text-indigo-605 rounded-lg border border-transparent hover:border-gray-100 transition-all cursor-pointer"
                  title="Download High-Res QR"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 bg-gray-50/50 border border-gray-100/80 rounded-2xl relative group w-full flex justify-center">
                <img
                  src={qrCodeUrl}
                  alt="Campaign Tracker QR Code"
                  className="w-40 h-40 select-none rounded-xl bg-white p-2 border border-gray-100"
                />
                <div className="absolute inset-0 bg-indigo-950/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center pointer-events-none">
                  <span className="text-[10px] bg-white text-indigo-950 font-bold px-2 py-1 rounded shadow animate-pulse">Scan to Test</span>
                </div>
              </div>

              <div className="text-xs text-gray-400 leading-relaxed max-w-[240px]">
                Download or share this high-resolution QR code vector directly on posters, flyers, print ads, or business displays.
              </div>

              <button
                onClick={downloadQRCode}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download Print-Ready PNG</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: Geo radar coordinates helper and log Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top geographic hotspots */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-950">Top Visitor Locations</h3>
            <p className="text-xs text-gray-400">Captured metropolitan focus hot zones.</p>
          </div>

          {topCities.length === 0 ? (
            <div className="py-12 flex items-center justify-center border border-dashed border-gray-150 rounded-xl text-xs text-gray-400 font-mono text-center px-4">
              Awaiting geographic coordinates.
            </div>
          ) : (
            <div className="space-y-3">
              {topCities.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg flex items-center justify-center select-none">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{entry.city || 'Unknown City'}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mt-0.5">{entry.country || 'Unknown Country'}</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50/70 px-2.5 py-1 rounded-lg">
                    {entry.total} {entry.total === 1 ? 'Hit' : 'Hits'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Geo radar vector coordinates representation */}
          <div className="bg-indigo-950/95 text-white p-4.5 rounded-2xl shadow-inner relative overflow-hidden select-none">
            <div className="relative z-10">
              <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-bold tracking-wider uppercase mb-1">
                <Compass className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                <span>Micro Pinpoint Scanner</span>
              </div>
              <p className="text-[10px] text-indigo-400">Radar logs absolute relative offset of last captures.</p>
              
              {/* Dummy absolute radar targeting system */}
              <div className="w-full h-24 my-3 bg-indigo-950 border border-indigo-800/80 rounded-xl relative flex items-center justify-center overflow-hidden">
                {/* Radar Lines */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border border-indigo-800/40 rounded-full animate-ping" />
                  <div className="w-16 h-16 border border-indigo-700/30 rounded-full" />
                  <div className="w-8 h-8 border border-indigo-700/50 rounded-full" />
                  <div className="h-full w-px bg-indigo-900/60 absolute left-1/2" />
                  <div className="w-full h-px bg-indigo-900/60 absolute top-1/2" />
                </div>
                {/* Pinpoint vector markers */}
                {visits.slice(0, 3).map((v, i) => {
                  if (v.latitude && v.longitude) {
                    const offsetIndex = (i * 17) % 35 - 15;
                    const topOffset = (i * 27) % 35 - 15;
                    return (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                        style={{
                          transform: `translate(${offsetIndex}px, ${topOffset}px)`
                        }}
                        className="w-2.5 h-2.5 bg-emerald-400 rounded-full absolute shadow-lg shadow-emerald-400/50 flex items-center justify-center"
                        title={`${v.city}`}
                      >
                        <span className="w-1 h-1 bg-white rounded-full" />
                      </motion.div>
                    );
                  }
                  return null;
                })}
              </div>

              <div className="flex items-center justify-between text-[10px] text-indigo-300 font-semibold mt-1">
                <span>Vector: GPS Enabled</span>
                <span className="text-emerald-400">Status: Listening...</span>
              </div>
            </div>
            
            <div className="absolute -right-12 -bottom-12 w-28 h-28 bg-indigo-800/10 rounded-full blur-xl pointer-events-none" />
          </div>
        </div>

        {/* Detailed Visits Log ledger */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-950">Detailed Security Ledger</h3>
              <p className="text-xs text-gray-400">Absolute logs chronological record of active campaigns.</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-gray-50 border border-gray-150 text-gray-500 rounded-lg">
              Showing {visits.length} logs
            </span>
          </div>

          {visits.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center border border-dashed border-gray-150 rounded-2xl text-center">
              <Globe2 className="w-8 h-8 text-gray-300 mb-3" />
              <p className="text-xs font-bold text-gray-600">No Visitor Telemetry Active</p>
              <p className="text-[11px] text-gray-400 px-8 mt-1 leading-relaxed">
                Provide the generated tracking url above to users. Their geographical details will load immediately in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {visits.map((vis) => (
                <div 
                  key={vis.id}
                  className="p-4 border border-gray-100 bg-gray-50/50 hover:bg-gray-50/80 transition-all rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-gray-800 bg-white border border-gray-150 px-2 py-0.5 rounded text-[11px]">
                        {vis.ip}
                      </span>
                      {vis.method === 'gps' ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[10px] font-bold inline-flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-emerald-500" /> GPS Pinpoint
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[10px] font-bold inline-flex items-center gap-0.5">
                          <Globe2 className="w-3 h-3 text-gray-400" /> IP Fallback
                        </span>
                      )}
                      
                      {vis.accuracy && (
                        <span className="text-[10px] bg-sky-50 text-sky-700 border border-sky-100 rounded px-1.5 font-mono">
                          Acc: ±{Math.round(vis.accuracy)}m
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1 text-xs text-gray-600 font-sans">
                      <span className="font-semibold text-gray-900">
                        {vis.city || 'Unknown'}, {vis.region ? `${vis.region}, ` : ''}{vis.country}
                      </span>
                      <span className="text-[10px] font-mono text-gray-450 flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
                        {new Date(vis.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[10px] font-mono text-gray-400 truncate max-w-lg" title={vis.userAgent}>
                      UA: {vis.userAgent}
                    </p>
                  </div>

                  {vis.latitude && vis.longitude ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${vis.latitude},${vis.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm shrink-0 hover:shadow shadow-indigo-650/10 cursor-pointer text-center"
                    >
                      <span>Show Coordinates</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-400 italic">No Coordinates</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
