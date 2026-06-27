import React, { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Link2, Sparkles, Copy, Check, Info, Plus, QrCode, Download } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';

interface LinkGeneratorProps {
  userId: string;
  onLinkCreated: () => void;
}

export default function LinkGenerator({ userId, onLinkCreated }: LinkGeneratorProps) {
  const [title, setTitle] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (generatedLink) {
      setQrLoading(true);
      QRCode.toDataURL(generatedLink, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff'
        }
      })
        .then(url => {
          setQrCodeUrl(url);
          setQrLoading(false);
        })
        .catch(err => {
          console.error("Failed to generate QR Code:", err);
          setQrLoading(false);
        });
    } else {
      setQrCodeUrl('');
    }
  }, [generatedLink]);

  // Validate and submit tracking link
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setGeneratedLink('');

    if (!title.trim()) {
      setErrorText('Please specify a recognizable title or name for your tracking campaign.');
      return;
    }

    if (!destinationUrl.trim()) {
      setErrorText('A valid redirection destination URL is required.');
      return;
    }

    // Direct url validation
    let sanitizedUrl = destinationUrl.trim();
    if (!/^https?:\/\//i.test(sanitizedUrl)) {
      sanitizedUrl = 'https://' + sanitizedUrl;
    }

    try {
      setLoading(true);
      
      // Generate unique short identifier
      const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const linkDocRef = doc(db, 'links', shortId);

      const payload = {
        id: shortId,
        title: title.trim(),
        destinationUrl: sanitizedUrl,
        creatorId: userId,
        createdAt: serverTimestamp(),
        clicksCount: 0
      };

      await setDoc(linkDocRef, payload);

      // Build absolute tracking path
      const baseMainPath = window.location.origin + window.location.pathname;
      const completeTrackerUrl = `${baseMainPath}?t=${shortId}`;
      
      setGeneratedLink(completeTrackerUrl);
      setTitle('');
      setDestinationUrl('');
      onLinkCreated();
    } catch (err) {
      console.error("Link generation failure: ", err);
      setErrorText('Failed to register link. Please verify write permissions.');
      handleFirestoreError(err, OperationType.CREATE, `links`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `qr_${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'tracker'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/40 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
          <Link2 className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-950">Create Tracking Link</h2>
          <p className="text-xs text-gray-400">Deploy custom campaign URLs with live analytics triggers.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="title-inp" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Campaign Name / Identifer
          </label>
          <input
            id="title-inp"
            type="text"
            required
            placeholder="e.g. Newsletter Promo Link, Customer Survey Ticket"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-gray-900"
          />
        </div>

        <div>
          <label htmlFor="url-inp" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Redirection Destination URL
          </label>
          <input
            id="url-inp"
            type="text"
            required
            placeholder="e.g. blog.yoursite.com/post-name or https://amazon.com"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-gray-900"
          />
        </div>

        {errorText && (
          <div className="flex items-center gap-2 p-3.5 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs">
            <Info className="w-4 h-4 shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Generate Tracking Coordinate Link</span>
            </>
          )}
        </button>
      </form>

      <AnimatePresence>
        {generatedLink && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 p-4 bg-emerald-50/50 border border-emerald-100/60 rounded-2xl"
          >
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-2">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-bounce" />
              <span>Tracking Link Activated!</span>
            </div>
            
            <p className="text-xs text-emerald-700/80 mb-3 leading-relaxed">
              Anyone opening this URL will have their IP location logged. If they consent to coordinate scanning, high-precision GPS coordinates will be captured.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="flex-1 px-3 py-2 bg-white border border-emerald-200 text-emerald-950 font-mono text-xs rounded-xl focus:outline-none select-all"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Print Media QR Code Block */}
            {qrCodeUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 pt-4 border-t border-emerald-100/60 flex flex-col items-center text-center space-y-3"
              >
                <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>Print Media QR Code</span>
                </div>
                <div className="p-3 bg-white border border-emerald-100 rounded-xl shadow-inner relative group">
                  <img
                    src={qrCodeUrl}
                    alt="Quick Response Tracker Code"
                    className="w-36 h-36 mx-auto select-none rounded-lg"
                  />
                  <div className="absolute inset-0 bg-indigo-950/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] bg-white text-indigo-950 font-bold px-2 py-1 rounded shadow">Scan to Test</span>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-700/70 max-w-[240px] leading-normal">
                  Download this high-resolution code to print on banners, flyers, business cards, or brochures.
                </p>
                <button
                  type="button"
                  onClick={downloadQRCode}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download High-Res PNG</span>
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
