"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Phone, Video, CheckCircle, Calendar, Clock, MapPin } from "lucide-react";

const DAYS = ["LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM.", "DIM."];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  return { daysInMonth, offset };
}

function formatDateFr(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const dayName = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"][d.getDay()];
  return `${dayName} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface Slot {
  start: string;
  end: string;
  assignedTo: string;
  assignedName: string;
  assignedFirstName: string;
  assignedPhoto: string;
}

export default function BookingGeneralPage() {
  return (
    <Suspense>
      <BookingGeneralContent />
    </Suspense>
  );
}

function BookingGeneralContent() {
  const searchParams = useSearchParams();
  const clientType = searchParams.get("type") || "";
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"phone" | "visio">("phone");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", company: "", source: "", website: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { daysInMonth, offset } = getMonthDays(viewYear, viewMonth);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  async function selectDate(day: number) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setSlots([]);

    try {
      const res = await fetch(`/api/booking-general/slots?date=${dateStr}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    }
    setLoadingSlots(false);
  }

  async function handleConfirm() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking-general/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          time: selectedSlot.start.slice(11, 16),
          assignedTo: selectedSlot.assignedTo,
          assignedName: selectedSlot.assignedName,
          mode,
          clientType,
          ...form,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const params = new URLSearchParams({
          name: selectedSlot.assignedFirstName,
          photo: selectedSlot.assignedPhoto,
        });
        window.location.href = `/confirmation-reservation?${params.toString()}`;
        return;
      } else {
        setError(data.error || "Une erreur est survenue.");
      }
    } catch {
      setError("Une erreur est survenue.");
    }
    setSubmitting(false);
  }

  const isPastDate = (day: number) => {
    const d = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return d < todayStr;
  };

  const isWeekend = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  return (
    <>
    <style>{`
      @media (max-width: 640px) {
        .booking-card { flex-direction: column !important; }
        .booking-card > div { flex: 1 1 100% !important; min-width: 0 !important; border-right: none !important; border-bottom: 1px solid #e8ecf1; }
        .booking-card > div:last-child { border-bottom: none; }
        .booking-form-grid { grid-template-columns: 1fr !important; }
        .booking-step-connector { width: 40px !important; }
      }
      @media (max-width: 768px) {
        .booking-3col { flex-direction: column !important; }
        .booking-3col > div:first-child { width: 100% !important; }
      }
    `}</style>
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 50%, #f5f8fc 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "30px 16px",
    }}>
      {/* Progress steps */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
        {[1, 2, 3].map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <div className="booking-step-connector" style={{ width: 60, height: 2, background: step >= s ? "#FF6B35" : "#dce8f0", margin: "0 0 20px 0" }} />}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: step >= s ? "#FF6B35" : "#dce8f0",
                color: step >= s ? "white" : "#8399a9", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
              }}>
                {step > s ? <CheckCircle style={{ width: 16, height: 16 }} /> : s}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: step >= s ? "#1a2a3a" : "#8399a9", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {s === 1 ? "Choisir l'heure" : s === 2 ? "Vos informations" : "Confirmation"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Logo only (no person photo in step 1 & 2) */}
      {step < 3 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, border: "2px solid #0a3d5f", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "4px 6px",
          }}>
            <span style={{
              color: "#0a3d5f", fontSize: 8, fontWeight: 700, lineHeight: 1.2,
              textAlign: "center", fontFamily: "'Montserrat', sans-serif",
              letterSpacing: "-0.02em",
            }}>
              LA<br />CLOSING<br />ACAD&Eacute;MIE<span style={{ fontSize: 5, verticalAlign: "super" }}>&reg;</span>
            </span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>La Closing Acad&eacute;mie</span>
        </div>
      )}

      {/* Step 1: Calendar + Slots */}
      {step === 1 && (
        <div style={{
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
          borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          maxWidth: 1100, width: "100%", overflow: "hidden",
          display: "flex", flexWrap: "wrap",
        }} className="booking-card">
          {/* Left: Intro text */}
          <div style={{ flex: "1 1 0", minWidth: 220, padding: "30px 24px", borderRight: "1px solid #e8ecf1", lineHeight: 1.7, fontSize: 13, color: "#1a2a3a" }}>
            <p style={{ marginBottom: 12, fontSize: 15, fontWeight: 600 }}>Bonjour,</p>
            <p style={{ marginBottom: 12 }}>Merci pour l&apos;int&eacute;r&ecirc;t que vous portez &agrave; <strong>La Closing Acad&eacute;mie</strong> !</p>
            <p style={{ marginBottom: 14 }}>Afin de mieux comprendre vos enjeux lors de notre bilan, je vous invite &agrave; pr&eacute;parer en amont :</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "0 0 14px 0" }}>
              {["Nombre de leads / de cibles", "Nombre de RDVs r\u00e9alis\u00e9s", "Nombre de signatures", "Chiffre d\u2019affaires"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#f0f6fa", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#1a2a3a" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF6B35", flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            <p style={{ marginBottom: 12 }}>Ainsi je pourrai vous dire facilement comment nous pourrons vous accompagner dans votre croissance.</p>
            <p style={{ marginBottom: 0, fontStyle: "italic", color: "#5a6f80" }}>Au plaisir de faire votre connaissance,<br /><strong style={{ color: "#1a2a3a", fontStyle: "normal" }}>L&apos;&eacute;quipe La Closing Acad&eacute;mie</strong></p>
          </div>
          {/* Center: Calendar */}
          <div style={{ flex: "1.5 1 0", minWidth: 340, padding: "30px 24px", borderRight: "1px solid #e8ecf1" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2a3a", textAlign: "center", marginBottom: 4 }}>
              R&eacute;server un rendez-vous
            </h2>

            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "16px 0" }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#1a6b9c" }}>
                <ChevronLeft style={{ width: 20, height: 20 }} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1a2a3a", textTransform: "capitalize" }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#1a6b9c" }}>
                <ChevronRight style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Days header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {DAYS.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#8399a9", padding: "4px 0" }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const past = isPastDate(day);
                const weekend = isWeekend(day);
                const disabled = past || weekend;
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;

                return (
                  <button
                    key={day}
                    disabled={disabled}
                    onClick={() => selectDate(day)}
                    style={{
                      width: "100%", aspectRatio: "1", borderRadius: 10,
                      border: isSelected ? "2px solid #1a6b9c" : isToday ? "2px solid #FF6B35" : "1px solid transparent",
                      background: isSelected ? "#e8f0fe" : "transparent",
                      color: disabled ? "#ccc" : isSelected ? "#1a6b9c" : "#1a2a3a",
                      fontSize: 14, fontWeight: isSelected || isToday ? 700 : 500,
                      cursor: disabled ? "default" : "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Slots */}
          <div style={{ flex: "1 1 0", minWidth: 220, padding: "30px 24px" }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <MapPin style={{ width: 16, height: 16, color: "#8399a9" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>Lieu de la r&eacute;union</div>
                  <div style={{ fontSize: 12, color: "#5a6f80" }}>{mode === "visio" ? "Visioconf\u00e9rence (Zoom)" : "Appel t\u00e9l\u00e9phonique"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Clock style={{ width: 16, height: 16, color: "#8399a9" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>Dur&eacute;e du rendez-vous</div>
                  <div style={{ fontSize: 12, color: "#5a6f80" }}>15 min</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => setMode("phone")}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    border: `2px solid ${mode === "phone" ? "#1a6b9c" : "#dce8f0"}`,
                    background: mode === "phone" ? "#e8f0fe" : "white",
                    color: mode === "phone" ? "#1a6b9c" : "#8399a9",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <Phone style={{ width: 14, height: 14 }} /> T&eacute;l&eacute;phone
                </button>
                <button
                  onClick={() => setMode("visio")}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    border: `2px solid ${mode === "visio" ? "#1a6b9c" : "#dce8f0"}`,
                    background: mode === "visio" ? "#e8f0fe" : "white",
                    color: mode === "visio" ? "#1a6b9c" : "#8399a9",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <Video style={{ width: 14, height: 14 }} /> Visio
                </button>
              </div>
            </div>

            {!selectedDate ? (
              <div style={{ textAlign: "center", color: "#8399a9", fontSize: 14, padding: "40px 0" }}>
                <Calendar style={{ width: 32, height: 32, color: "#dce8f0", margin: "0 auto 12px" }} />
                S&eacute;lectionnez une date
              </div>
            ) : loadingSlots ? (
              <div style={{ textAlign: "center", color: "#8399a9", fontSize: 14, padding: "40px 0" }}>
                Chargement des disponibilit&eacute;s...
              </div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: "center", color: "#e74c3c", fontSize: 14, padding: "40px 0" }}>
                Aucun cr&eacute;neau disponible ce jour.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a", marginBottom: 8 }}>
                  Quelle heure vous convient le mieux ?
                </div>
                <div style={{ fontSize: 11, color: "#8399a9", marginBottom: 12 }}>
                  Affichage des heures pour le <strong>{formatDateFr(selectedDate)}</strong>
                </div>
                <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {slots.map((slot) => {
                    const time = slot.start.slice(11, 16);
                    const isActive = selectedSlot?.start === slot.start;
                    return (
                      <button
                        key={time}
                        onClick={() => setSelectedSlot(slot)}
                        style={{
                          height: 42, borderRadius: 8,
                          border: `2px solid ${isActive ? "#1a6b9c" : "#dce8f0"}`,
                          background: isActive ? "#1a6b9c" : "white",
                          color: isActive ? "white" : "#1a2a3a",
                          fontSize: 15, fontWeight: 600, cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
                {selectedSlot && (
                  <button
                    onClick={() => setStep(2)}
                    style={{
                      width: "100%", height: 44, borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)",
                      color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer",
                      marginTop: 16, boxShadow: "0 4px 15px rgba(255,107,53,0.3)",
                    }}
                  >
                    Continuer
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Information form */}
      {step === 2 && selectedSlot && (
        <div style={{
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
          borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          maxWidth: 600, width: "100%", padding: "30px 32px",
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2a3a", marginBottom: 4 }}>Vos informations</h2>
          <p style={{ fontSize: 13, color: "#5a6f80", marginBottom: 4 }}>
            <strong>{formatDateFr(selectedDate!)}</strong> &agrave; <strong>{selectedSlot.start.slice(11, 16)}</strong>
          </p>
          <p style={{ fontSize: 12, color: "#8399a9", marginBottom: 20 }}>
            <MapPin style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle" }} /> {mode === "visio" ? "Visioconf\u00e9rence" : "Appel t\u00e9l\u00e9phonique"}
            <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#1a6b9c", fontWeight: 600, cursor: "pointer", marginLeft: 8, fontSize: 12 }}>Modifier</button>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="booking-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Pr&eacute;nom *</label>
                <input style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Nom *</label>
                <input style={inputStyle} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Votre adresse e-mail *</label>
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Num&eacute;ro de t&eacute;l&eacute;phone *</label>
              <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Nom de l&apos;entreprise *</label>
              <input style={inputStyle} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Comment nous avez-vous connu ? *</label>
              <textarea
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>URL du site web</label>
              <input style={inputStyle} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "#fde8e8", borderLeft: "4px solid #e74c3c", color: "#c62828", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1, height: 44, borderRadius: 10, border: "1.5px solid #dce8f0",
                background: "white", color: "#5a6f80", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Retour
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting || !form.firstName || !form.lastName || !form.email || !form.phone || !form.company || !form.source}
              style={{
                flex: 2, height: 44, borderRadius: 10, border: "none",
                background: submitting ? "#8399a9" : "linear-gradient(135deg, #FF6B35 0%, #e65100 100%)",
                color: "white", fontSize: 15, fontWeight: 700, cursor: submitting ? "default" : "pointer",
                boxShadow: submitting ? "none" : "0 4px 15px rgba(255,107,53,0.3)",
              }}
            >
              {submitting ? "Confirmation..." : "Confirmer"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmation with assigned person photo + name */}
      {step === 3 && selectedSlot && (
        <div style={{
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
          borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          maxWidth: 500, width: "100%", padding: "40px 32px", textAlign: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "#e8f5e9",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <CheckCircle style={{ width: 32, height: 32, color: "#2e7d32" }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a2a3a", marginBottom: 8 }}>
            Rendez-vous confirm&eacute; !
          </h2>
          <p style={{ fontSize: 15, color: "#5a6f80", marginBottom: 24 }}>
            Votre rendez-vous est pr&eacute;vu le<br />
            <strong style={{ color: "#1a2a3a" }}>{formatDateFr(selectedDate!)} &agrave; {selectedSlot.start.slice(11, 16)}</strong>
          </p>

          {/* Photo + name of assigned person */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
            padding: "16px 20px", background: "#f0f6fa", borderRadius: 14, marginBottom: 20,
          }}>
            <img
              src={selectedSlot.assignedPhoto}
              alt={selectedSlot.assignedFirstName}
              style={{
                width: 52, height: 52, borderRadius: "50%",
                objectFit: "cover", objectPosition: "top",
                border: "2px solid #fff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, color: "#8399a9", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Votre interlocuteur
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1a2a3a" }}>
                {selectedSlot.assignedFirstName}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 8 }}>
            {mode === "visio"
              ? <><Video style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle" }} /> Visioconf&eacute;rence &mdash; 15 min</>
              : <><Phone style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle" }} /> Appel t&eacute;l&eacute;phonique &mdash; 15 min</>
            }
          </p>
          <p style={{ fontSize: 12, color: "#8399a9", marginTop: 16 }}>
            Un email de confirmation avec une invitation calendrier vous a &eacute;t&eacute; envoy&eacute;.
          </p>
        </div>
      )}

      {/* Footer */}
      <p style={{ fontSize: 11, color: "#8399a9", marginTop: 30 }}>
        &copy; {new Date().getFullYear()} La Closing Acad&eacute;mie&reg; &mdash; Tous droits r&eacute;serv&eacute;s
      </p>
    </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#5a6f80", display: "block", marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", height: 42, borderRadius: 8, border: "1.5px solid #dce8f0",
  padding: "0 12px", fontSize: 14, color: "#1a2a3a", outline: "none",
  background: "#f8fbfd",
};
