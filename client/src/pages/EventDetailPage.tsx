import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Calendar, MapPin, Clock, Users, QrCode, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { eventsApi, registrationsApi, type EventDetail } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Navbar from "../components/Navbar";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: "badge-success",
    ONGOING: "badge-primary",
    DRAFT: "badge-muted",
    COMPLETED: "badge-info",
    CANCELLED: "badge-error",
  };
  return <span className={`badge ${map[status] || "badge-muted"}`}>{status}</span>;
}

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [myRegId, setMyRegId] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);

  const id = parseInt(eventId || "0");

  useEffect(() => {
    const ctrl = new AbortController();
    eventsApi.get(id, ctrl.signal)
      .then(res => setEvent(res.event))
      .catch(() => setError("Event not found"))
      .finally(() => setLoading(false));
    if (user?.role === "ATTENDEE") {
      registrationsApi.myRegistrations(ctrl.signal).then(res => {
        const reg = res.registrations.find(r => r.event_id === id && r.status !== "CANCELLED");
        if (reg) { setIsRegistered(true); setMyRegId(reg.id); }
      }).catch(() => {});
    }
    return () => ctrl.abort();
  }, [id, user]);

  const handleRegister = async () => {
    if (!user) { navigate("/login"); return; }
    setRegistering(true);
    try {
      const res = await registrationsApi.register(id);
      const status = res.registration.status;
      if (status === "REGISTERED") { toastSuccess("Registered! View your QR pass in My Events."); setMyRegId(res.registration.id); }
      else if (status === "WAITLISTED") toastSuccess(`Waitlisted — position #${res.registration.waitlist_position}`);
      setIsRegistered(true);
      setEvent(prev => prev ? { ...prev, registered_count: prev.registered_count + 1 } : prev);
    } catch (err: any) { toastError(err.message || "Registration failed"); }
    finally { setRegistering(false); }
  };

  if (loading) return (
    <div className="page-container"><Navbar />
      <div style={{ display:"flex", justifyContent:"center", alignItems:"center", minHeight:"80vh" }}>
        <div className="spinner" style={{ width:48, height:48 }} />
      </div>
    </div>
  );

  if (error || !event) return (
    <div className="page-container"><Navbar />
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"80vh", gap:16 }}>
        <AlertCircle size={48} style={{ color:"var(--color-masterpiece-red)" }} />
        <h2 style={{ fontSize:22 }}>Event not found</h2>
        <Link to="/events" className="btn btn-secondary">Back to Events</Link>
      </div>
    </div>
  );

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const isFull = event.registered_count >= event.capacity;
  const pct = event.capacity > 0 ? Math.min(100, Math.round((event.registered_count / event.capacity) * 100)) : 0;
  const capacityColor = pct >= 100 ? "var(--color-masterpiece-red)" : pct >= 80 ? "var(--color-sidecar-yellow)" : "var(--color-authentic-teal)";

  return (
    <div className="page-container"><Navbar />
      <div style={{ marginTop:64, minHeight:"calc(100vh - 64px)", padding:"40px 20px", maxWidth:860, margin:"64px auto 0", width:"100%" }}>
        <Link to="/events" style={{ display:"flex", alignItems:"center", gap:6, fontSize:14, color:"var(--color-text-muted)", textDecoration:"none", marginBottom:24 }}>
          <ArrowLeft size={16} /> Back to Events
        </Link>

        <div className="card-elevated" style={{ padding:"32px 36px", marginBottom:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, flexWrap:"wrap" }}>
                <StatusBadge status={event.status} />
                {isRegistered && <span className="badge badge-success"><CheckCircle size={12} /> Registered</span>}
              </div>
              <h1 style={{ fontSize:32, fontFamily:"Playfair Display, Tempting, serif", fontWeight:800, lineHeight:1.2, marginBottom:20 }}>{event.name}</h1>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:15, color:"var(--color-text-muted)" }}>
                  <MapPin size={16} style={{ color:"var(--color-authentic-teal)", flexShrink:0 }} />{event.location}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:15, color:"var(--color-text-muted)" }}>
                  <Calendar size={16} style={{ color:"var(--color-authentic-teal)", flexShrink:0 }} />
                  {startDate.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" })}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:15, color:"var(--color-text-muted)" }}>
                  <Clock size={16} style={{ color:"var(--color-authentic-teal)", flexShrink:0 }} />
                  {startDate.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })} &ndash; {endDate.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" })}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:160 }}>
              {user?.role === "ATTENDEE" && isRegistered && myRegId ? (
                <Link to={`/my-pass/${myRegId}`} className="btn btn-primary" id="view-pass-btn"><QrCode size={16} /> View QR Pass</Link>
              ) : user?.role === "ATTENDEE" && !isRegistered ? (
                <button type="button" className={`btn ${isFull ? "btn-secondary" : "btn-primary"}`} onClick={handleRegister} disabled={registering || event.status === "CANCELLED" || event.status === "COMPLETED"} id="register-btn">
                  {registering ? <Loader2 size={16} className="animate-spin-slow" /> : null}
                  {registering ? "Registering..." : isFull ? "Join Waitlist" : "Register Now"}
                </button>
              ) : !user ? (
                <Link to="/login" className="btn btn-primary" id="login-to-register-btn">Log in to Register</Link>
              ) : null}
            </div>
          </div>
        </div>

        {event.description && (
          <div className="card-elevated" style={{ padding:"24px 36px", marginBottom:24 }}>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:14 }}>About This Event</h2>
            <p style={{ color:"var(--color-text-muted)", lineHeight:1.75, fontSize:15 }}>{event.description}</p>
          </div>
        )}

        <div className="card-elevated" style={{ padding:"24px 36px", marginBottom:24 }}>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Capacity</h2>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, marginBottom:8, color:"var(--color-text-muted)" }}>
            <span style={{ display:"flex", alignItems:"center", gap:6 }}><Users size={14} />{event.registered_count} / {event.capacity} registered</span>
            <span style={{ fontWeight:700, color:capacityColor }}>{pct}%</span>
          </div>
          <div className="progress-bar" style={{ height:10 }}>
            <div className="progress-fill" style={{ width:`${pct}%`, background:capacityColor }} />
          </div>
          {event.waitlisted_count > 0 && (
            <p style={{ fontSize:13, color:"var(--color-sidecar-yellow)", marginTop:10 }}>{event.waitlisted_count} people on the waitlist</p>
          )}
        </div>

        {event.stations?.length > 0 && (
          <div className="card-elevated" style={{ padding:"24px 36px" }}>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Check-In Gates</h2>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {event.stations.map(s => (
                <span key={s.id} className="badge badge-primary" style={{ fontSize:13, padding:"6px 14px" }}>{s.gate_name} — {s.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
