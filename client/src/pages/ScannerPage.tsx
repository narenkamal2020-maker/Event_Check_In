import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode, CheckCircle, XCircle, Wifi, WifiOff,
  ArrowLeft, ZapOff, RotateCcw, Upload, AlertTriangle, Scan
} from 'lucide-react';
import { eventsApi, checkInApi, type EventDetail } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';
import { useToast } from '../context/ToastContext';
import Navbar from '../components/Navbar';

type ScanState = 'idle' | 'success' | 'error' | 'loading';

interface ScanResult {
  type: 'success' | 'error';
  message: string;
  attendeeName?: string;
  gateName?: string;
}

const DEVICE_ID = `scanner-${Math.random().toString(36).slice(2, 8)}`;

export default function ScannerPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const id = parseInt(eventId || '0');
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const qrRef = useRef<Html5Qrcode | null>(null);
  const scannerDivId = 'qr-scanner-div';
  const lastScannedToken = useRef('');
  const scanCooldown = useRef(false);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    eventsApi.get(id, ctrl.signal).then(res => {
      setEvent(res.event);
      if (res.event.stations?.length > 0) {
        setSelectedStationId(res.event.stations[0].id);
      }
    });
    return () => ctrl.abort();
  }, [id]);

  useEffect(() => {
    offlineStorage.getPendingCount().then(setPendingCount);
  }, []);

  const processToken = useCallback(async (rawToken: string) => {
    if (!selectedStationId) { toastError('Select a gate station first'); return; }
    if (scanCooldown.current) return;
    if (rawToken === lastScannedToken.current) return;

    scanCooldown.current = true;
    lastScannedToken.current = rawToken;
    setTimeout(() => { scanCooldown.current = false; lastScannedToken.current = ''; }, 3000);

    setScanState('loading');

    if (!isOnline) {
      await offlineStorage.addScan({
        clientScanId: `${DEVICE_ID}-${Date.now()}`,
        registrationToken: rawToken,
        stationId: selectedStationId,
        deviceId: DEVICE_ID,
        scannedAtClient: new Date().toISOString(),
      });
      const count = await offlineStorage.getPendingCount();
      setPendingCount(count);
      setScanState('success');
      setLastResult({ type: 'success', message: 'Queued offline — will sync when back online', gateName: 'QUEUED' });
      toastInfo('Offline mode: scan queued');
      setTimeout(() => setScanState('idle'), 3000);
      return;
    }

    try {
      const result = await checkInApi.scanToken(id, rawToken, selectedStationId, DEVICE_ID);
      setScanState('success');
      setLastResult({
        type: 'success',
        message: `Welcome, ${result.attendeeName}!`,
        attendeeName: result.attendeeName,
        gateName: result.gateName,
      });
      setTimeout(() => setScanState('idle'), 3500);
    } catch (err: any) {
      setScanState('error');
      const msg = err.message || 'Scan failed';
      setLastResult({ type: 'error', message: msg });
      setTimeout(() => setScanState('idle'), 3500);
    }
  }, [id, selectedStationId, isOnline, toastError, toastInfo]);

  const startScanner = async () => {
    setScannerError('');
    try {
      const qr = new Html5Qrcode(scannerDivId);
      qrRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => processToken(decodedText),
        () => {}
      );
      setScannerStarted(true);
    } catch (err: any) {
      setScannerError(err.message || 'Could not access camera');
    }
  };

  const stopScanner = async () => {
    if (qrRef.current) {
      await qrRef.current.stop().catch(() => {});
      qrRef.current = null;
    }
    setScannerStarted(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const handleSyncOffline = async () => {
    setSyncing(true);
    try {
      const scans = await offlineStorage.getPendingScans();
      if (scans.length === 0) { toastInfo('No pending scans to sync'); setSyncing(false); return; }
      const result = await checkInApi.syncOffline(id, scans);
      for (const r of result.results) {
        if (r.status === 'SUCCESS') await offlineStorage.markSynced(scans.find(s => s.clientScanId === r.clientScanId)!.clientScanId);
        else await offlineStorage.markConflict(scans.find(s => s.clientScanId === r.clientScanId)!.clientScanId || r.clientScanId);
      }
      const remaining = await offlineStorage.getPendingCount();
      setPendingCount(remaining);
      toastSuccess(`Synced ${result.synced} scans. ${result.conflicts} conflicts.`);
    } catch (err: any) {
      toastError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const scanBorderColor = scanState === 'success'
    ? 'rgba(74,222,128,0.6)'
    : scanState === 'error'
      ? 'rgba(248,113,113,0.6)'
      : 'rgba(255,255,255,0.2)';

  return (
    <div className="page-container">
      <Navbar />
      <div style={{
        marginTop: 64,
        minHeight: 'calc(100vh - 64px)',
        padding: '32px 20px',
        maxWidth: 560,
        margin: '64px auto 0',
        width: '100%',
      }}>
        {/* Back link */}
        <Link
          to={`/organizer/events/${id}/dashboard`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--color-text-subtle)', textDecoration: 'none',
            marginBottom: 28, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-subtle)')}
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div className="section-eyebrow" style={{ marginBottom: 8 }}>QR Verification</div>
          <h1 style={{
            fontSize: 'clamp(28px, 6vw, 44px)', fontWeight: 900,
            letterSpacing: '-0.03em', textTransform: 'uppercase', lineHeight: 1.05,
            marginBottom: 6,
          }}>
            EVENTRA SCAN
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '0.04em' }}>
            SCAN · VERIFY · ENTER
          </p>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-subtle)' }}>{event?.name || '...'}</span>
            {isOnline ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-success)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <Wifi size={10} /> ONLINE
              </span>
            ) : (
              <span className="offline-badge"><WifiOff size={10} /> OFFLINE</span>
            )}
          </div>
        </div>

        {/* Gate selector */}
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label" htmlFor="gate-selector">Active Gate</label>
          <select
            id="gate-selector"
            className="select-field"
            value={selectedStationId || ''}
            onChange={e => setSelectedStationId(parseInt(e.target.value))}
          >
            {event?.stations?.map(s => (
              <option key={s.id} value={s.id}>{s.gate_name} — {s.name}</option>
            ))}
          </select>
        </div>

        {/* Scanner viewport */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div
            id={scannerDivId}
            style={{
              width: '100%',
              maxWidth: 420,
              margin: '0 auto',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              border: `2px solid ${scanBorderColor}`,
              background: '#000',
              minHeight: scannerStarted ? undefined : 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border-color 0.3s ease',
              position: 'relative',
            }}
          >
            {!scannerStarted && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-subtle)', padding: 48 }}>
                <Scan size={48} style={{ marginBottom: 16, opacity: 0.25 }} />
                <div className="text-label" style={{ marginBottom: 6 }}>Camera inactive</div>
                <p style={{ fontSize: 12, color: 'var(--color-text-faint)' }}>Press Start Scanner below</p>
              </div>
            )}
          </div>

          {/* Geometric corner markers overlay (shown when started) */}
          {scannerStarted && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              {/* Frame */}
              <div style={{ position: 'relative', width: 240, height: 240 }}>
                <div className="scanner-corner scanner-corner-tl" />
                <div className="scanner-corner scanner-corner-tr" />
                <div className="scanner-corner scanner-corner-bl" />
                <div className="scanner-corner scanner-corner-br" />
                <div className="scanner-scan-line" />
              </div>

              {/* Loading overlay */}
              {scanState === 'loading' && (
                <div style={{
                  position: 'absolute',
                  background: 'rgba(0,0,0,0.75)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 18px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
                }}>
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                  VALIDATING...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {!scannerStarted ? (
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={startScanner}
              id="start-scanner-btn"
            >
              <QrCode size={15} />
              START SCANNER
            </button>
          ) : (
            <button
              className="btn btn-danger"
              style={{ flex: 1 }}
              onClick={stopScanner}
              id="stop-scanner-btn"
            >
              <ZapOff size={15} />
              STOP SCANNER
            </button>
          )}
          {pendingCount > 0 && (
            <button
              className="btn btn-secondary"
              onClick={handleSyncOffline}
              disabled={!isOnline || syncing}
              id="sync-offline-btn"
            >
              {syncing
                ? <div className="spinner" style={{ width: 14, height: 14 }} />
                : <Upload size={14} />
              }
              SYNC ({pendingCount})
            </button>
          )}
        </div>

        {/* Scanner error */}
        {scannerError && (
          <div style={{
            background: 'var(--color-error-dim)',
            border: '1px solid var(--color-error-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex', gap: 10, alignItems: 'center',
            marginBottom: 16, fontSize: 13, color: 'var(--color-error)',
          }}>
            <AlertTriangle size={16} />
            {scannerError}
          </div>
        )}

        {/* Last scan result */}
        {lastResult && (
          <div
            className={lastResult.type === 'success' ? 'scan-result-success' : 'scan-result-error'}
            id="scan-result"
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {lastResult.type === 'success'
                ? <CheckCircle size={22} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
                : <XCircle size={22} style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 2 }} />
              }
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>
                  {lastResult.type === 'success' ? 'CHECK-IN CONFIRMED' : 'CHECK-IN FAILED'}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  {lastResult.attendeeName || lastResult.message}
                </div>
                {lastResult.attendeeName && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{lastResult.message}</div>
                )}
                {lastResult.gateName && (
                  <div style={{ fontSize: 11, marginTop: 6, color: 'var(--color-text-subtle)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    GATE: {lastResult.gateName}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Offline queue info */}
        {!isOnline && (
          <div style={{
            marginTop: 16,
            background: 'var(--color-warning-dim)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            fontSize: 13, color: 'var(--color-warning)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>
              OFFLINE MODE ACTIVE
            </div>
            Scans are being queued locally ({pendingCount} pending). They'll sync automatically when back online.
          </div>
        )}

        {/* Manual token input */}
        <div className="divider" style={{ margin: '28px 0' }} />
        <div>
          <div className="text-label" style={{ marginBottom: 10 }}>Manual Token Input</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="manual-token-input"
              type="text"
              className="input-field"
              placeholder="Paste QR token here..."
              style={{ fontSize: 13 }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) { await processToken(val); (e.target as HTMLInputElement).value = ''; }
                }
              }}
            />
            <button
              className="btn btn-secondary btn-sm btn-circle"
              id="manual-submit-btn"
              onClick={(e) => {
                const input = document.getElementById('manual-token-input') as HTMLInputElement;
                if (input?.value.trim()) processToken(input.value.trim());
              }}
              title="Submit token"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
