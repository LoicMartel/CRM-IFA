"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Phone, CheckCircle, Calendar, Clock, MapPin } from "lucide-react";

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

export default function BookingNazninePage() {
  return (
    <Suspense>
      <BookingNaznineContent />
    </Suspense>
  );
}

function BookingNaznineContent() {
  const searchParams = useSearchParams();
  const clientType = searchParams.get("type") || "";
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode] = useState<"phone">("phone");
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
      const res = await fetch(`/api/booking-naznine-decouverte/slots?date=${dateStr}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
      setAssignedTo(data.assignedTo);
      setAssignedName(data.assignedName);
    } catch {
      setSlots([]);
    }
    setLoadingSlots(false);
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking-naznine-decouverte/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          time: selectedSlot,
          assignedTo,
          mode,
          clientType,
          ...form,
        }),
      });
      const data = await res.json();
      if (data.success) {
        window.top!.location.href = "/confirmation-decouverte";
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
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f6fa 0%, #e8f0f7 50%, #f5f8fc 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "30px 16px",
    }}>
      {/* Progress steps */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: step >= 1 ? "#FF6B35" : "#dce8f0",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
          }}>
            {step > 1 ? <CheckCircle style={{ width: 16, height: 16 }} /> : "1"}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: step >= 1 ? "#1a2a3a" : "#8399a9", textTransform: "uppercase", letterSpacing: "0.05em" }}>Choisir l&apos;heure</span>
        </div>
        <div style={{ width: 80, height: 2, background: step >= 2 ? "#FF6B35" : "#dce8f0", margin: "0 0 20px 0" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: step >= 2 ? "#FF6B35" : "#dce8f0",
            color: step >= 2 ? "white" : "#8399a9", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
          }}>
            {step > 2 ? <CheckCircle style={{ width: 16, height: 16 }} /> : "2"}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: step >= 2 ? "#1a2a3a" : "#8399a9", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vos informations</span>
        </div>
      </div>

      {/* Logo + Photo Naznine */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 14, marginBottom: 24,
      }}>
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
            LA<br />CLOSING<br />ACADÉMIE<span style={{ fontSize: 5, verticalAlign: "super" }}>®</span>
          </span>
        </div>
        <img
          src="/photo-naznine.jpeg"
          alt="Naznine Mouhamad"
          style={{
            width: 56, height: 56, borderRadius: "50%",
            objectFit: "cover", objectPosition: "top",
            border: "2px solid #fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1a2a3a" }}>Naznine Mouhamad</span>
      </div>

      {/* Step 1: Calendar + Slots */}
      {step === 1 && (
        <div style={{
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
          borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          maxWidth: 900, width: "100%", overflow: "hidden",
          display: "flex", flexWrap: "wrap",
        }}>
          {/* Left: Calendar */}
          <div style={{ flex: "1 1 400px", padding: "30px 24px", borderRight: "1px solid #e8ecf1" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2a3a", textAlign: "center", marginBottom: 4 }}>
              Appel de d&eacute;couverte
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

          {/* Right: Slots + Options */}
          <div style={{ flex: "1 1 300px", padding: "30px 24px" }}>
            {/* Meeting info */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <MapPin style={{ width: 16, height: 16, color: "#8399a9" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>Lieu de la réunion</div>
                  <div style={{ fontSize: 12, color: "#5a6f80" }}>Appel téléphonique</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Clock style={{ width: 16, height: 16, color: "#8399a9" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a2a3a" }}>Durée du rendez-vous</div>
                  <div style={{ fontSize: 12, color: "#5a6f80" }}>15 min</div>
                </div>
              </div>

              {/* Mode fixe: téléphone */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                height: 36, borderRadius: 8, border: "2px solid #1a6b9c",
                background: "#e8f0fe", color: "#1a6b9c",
                fontSize: 12, fontWeight: 600, marginBottom: 16,
              }}>
                <Phone style={{ width: 14, height: 14 }} /> Appel téléphonique
              </div>
            </div>

            {/* Time slots */}
            {!selectedDate ? (
              <div style={{ textAlign: "center", color: "#8399a9", fontSize: 14, padding: "40px 0" }}>
                <Calendar style={{ width: 32, height: 32, color: "#dce8f0", margin: "0 auto 12px" }} />
                Sélectionnez une date
              </div>
            ) : loadingSlots ? (
              <div style={{ textAlign: "center", color: "#8399a9", fontSize: 14, padding: "40px 0" }}>
                Chargement des disponibilités...
              </div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: "center", color: "#e74c3c", fontSize: 14, padding: "40px 0" }}>
                Aucun créneau disponible ce jour.
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
                    const isActive = selectedSlot === time;
                    return (
                      <button
                        key={time}
                        onClick={() => { setSelectedSlot(time); }}
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
      {step === 2 && (
        <div style={{
          background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)",
          borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          maxWidth: 600, width: "100%", padding: "30px 32px",
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2a3a", marginBottom: 4 }}>Vos informations</h2>
          <p style={{ fontSize: 13, color: "#5a6f80", marginBottom: 4 }}>
            <strong>{formatDateFr(selectedDate!)}</strong> à <strong>{selectedSlot}</strong>
          </p>
          <p style={{ fontSize: 12, color: "#8399a9", marginBottom: 20 }}>
            <MapPin style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle" }} /> Appel téléphonique
            <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#1a6b9c", fontWeight: 600, cursor: "pointer", marginLeft: 8, fontSize: 12 }}>Modifier</button>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Prénom *</label>
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
              <label style={labelStyle}>Numéro de téléphone *</label>
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

      {/* Step 3: Confirmation */}
      {step === 3 && (
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
            Rendez-vous confirmé !
          </h2>
          <p style={{ fontSize: 15, color: "#5a6f80", marginBottom: 20 }}>
            Votre bilan commercial est prévu le<br />
            <strong style={{ color: "#1a2a3a" }}>{formatDateFr(selectedDate!)} à {selectedSlot}</strong>
          </p>
          <p style={{ fontSize: 13, color: "#8399a9", marginBottom: 8 }}>
            <MapPin style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle" }} /> Appel téléphonique
          </p>
          <p style={{ fontSize: 13, color: "#8399a9" }}>
            Avec <strong>{assignedName}</strong>
          </p>
          <p style={{ fontSize: 12, color: "#8399a9", marginTop: 20 }}>
            Un email de confirmation vous sera envoyé.
          </p>
        </div>
      )}

      {/* Footer */}
      <p style={{ fontSize: 11, color: "#8399a9", marginTop: 30 }}>
        © {new Date().getFullYear()} La Closing Académie® — Tous droits réservés
      </p>
    </div>
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
