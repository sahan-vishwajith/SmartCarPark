import "./App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import ParkingMap from "./components/ParkingMap";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useState, useEffect } from "react";

/* ─────────────────────────
 * Layout with Pre-book flow
 * ───────────────────────── */
function Layout({ children }) {
  const navigate = useNavigate();

  const [showPrebookInstructions, setShowPrebookInstructions] = useState(false);
  const [showPrebookPicker, setShowPrebookPicker] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [bookingDraft, setBookingDraft] = useState(null); // { date, startTime }

  const openPrebookFlow = () => {
    setShowPrebookInstructions(true);
    setShowPrebookPicker(false);
    setShowPaymentModal(false);
    setBookingDraft(null);
  };

  const closeAllPrebook = () => {
    setShowPrebookInstructions(false);
    setShowPrebookPicker(false);
    setShowPaymentModal(false);
    setBookingDraft(null);
  };

  const continueToPicker = () => {
    setShowPrebookInstructions(false);
    setShowPrebookPicker(true);
  };

  // called when user picks date + start time
  const handleDateTimeNext = (date, startTime) => {
    setBookingDraft({ date, startTime });
    setShowPrebookPicker(false);
    setShowPaymentModal(true);
  };

  // 🔁 called when backend returns bookingId + slotId
  const handlePaymentSuccess = (result) => {
    // result: { bookingId, slotId, date, startTime }
    setShowPaymentModal(false);
    setShowPrebookInstructions(false);
    setShowPrebookPicker(false);

    // 👉 go to full booking page
    navigate(`/booking/${result.bookingId}`, { state: result });
  };

  return (
    <div className="page">
      {/* Background layers */}
      <div className="bgRadial" />
      <div className="bgNoise" />

      {/* Navbar */}
      <header className="nav">
        <div className="navLeft">
          <div className="brand">
            <span className="brandAccent">Smart</span>
            <span className="brandWhite">Parking</span>
            <span className="brandWhite">App</span>
          </div>

          <nav className="navLinks">
            <button type="button" className="navLinkBtn">
              Bidding
            </button>
            {/* Pre-book triggers popup flow */}
            <button
              type="button"
              className="navLinkBtn"
              onClick={openPrebookFlow}
            >
              Pre-book
            </button>
          </nav>
        </div>

        <div className="navRight">
          <Link className="primaryBtn authBtn" to="/login">
            Login
          </Link>
          <Link className="primaryBtn authBtn" to="/register">
            Register
          </Link>
        </div>
      </header>

      {/* Page content */}
      {children}

      {/* 1️⃣ Pre-book Instructions Modal */}
      {showPrebookInstructions && (
        <div className="modalOverlay" onClick={closeAllPrebook}>
          <div
            className="modalCard"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Pre-book instructions"
          >
            <h2 className="modalTitle">Before you Pre-book</h2>

            <div className="modalBody">
              <ol className="stepsList">
                <li>Select your parking date and start time.</li>
                <li>Enter your payment details to confirm.</li>
                <li>We&apos;ll assign you a parking slot immediately.</li>
                <li>
                  You will see the updated parking map with your reserved slot
                  highlighted.
                </li>
              </ol>

              <div className="noteBox">
                <strong>Note:</strong> Please arrive on time to keep your
                reservation valid.
              </div>
            </div>

            <div className="modalActions">
              <button
                className="secondaryBtn modalBtn"
                onClick={closeAllPrebook}
              >
                Cancel
              </button>
              <button
                className="primaryBtn modalBtn"
                onClick={continueToPicker}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2️⃣ Date & Time Picker Modal (only date + start time) */}
      {showPrebookPicker && (
        <PrebookDateTimeModal
          onClose={closeAllPrebook}
          onNext={handleDateTimeNext}
        />
      )}

      {/* 3️⃣ Payment Modal */}
      {showPaymentModal && bookingDraft && (
        <PaymentModal
          bookingDraft={bookingDraft}
          onClose={closeAllPrebook}
          onBack={() => {
            setShowPaymentModal(false);
            setShowPrebookPicker(true);
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

/* ─────────────────────────
 * Date & Time modal (start only)
 * ───────────────────────── */
function PrebookDateTimeModal({ onClose, onNext }) {
  const [date, setDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [startTime, setStartTime] = useState("09:00");

  const handleContinue = () => {
    if (!date || !startTime) {
      alert("Please select a date and start time.");
      return;
    }
    onNext(date, startTime);
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select date and time"
      >
        <h2 className="modalTitle">Select Date &amp; Start Time</h2>

        <div className="modalBody">
          <div className="formGrid">
            <div className="field">
              <label className="fieldLabel">Date</label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label className="fieldLabel">Start Time</label>
              <input
                className="input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="noteBox">
            We&apos;ll assign you a parking slot after you confirm your payment.
          </div>
        </div>

        <div className="modalActions">
          <button className="secondaryBtn modalBtn" onClick={onClose}>
            Cancel
          </button>
          <button className="primaryBtn modalBtn" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────
 * Payment modal
 * ───────────────────────── */
function PaymentModal({ bookingDraft, onClose, onBack, onSuccess }) {
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);

  const confirmPayment = async () => {
    if (!cardName || !cardNumber || !expiry || !cvv) {
      alert("Please fill all payment details.");
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      alert("Please login first to pre-book a slot.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        date: bookingDraft.date,
        startTime: bookingDraft.startTime,
        payment: {
          cardName,
          cardNumber,
          expiry,
          cvv,
        },
      };

      const res = await fetch("http://localhost:5000/api/prebook-confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // 🔐 required
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(
          data.message ||
            data.error ||
            "Sorry, payment or booking could not be completed."
        );
        return;
      }

      if (!data.slotId || !data.bookingId) {
        alert("Backend did not return bookingId/slotId. Please check your API.");
        return;
      }

      // ✅ success – tell Layout so it can navigate
      onSuccess({
        bookingId: data.bookingId,
        slotId: data.slotId,
        date: bookingDraft.date,
        startTime: bookingDraft.startTime,
      });
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Payment details"
      >
        <h2 className="modalTitle">Payment Details</h2>

        <div className="modalBody">
          <p className="modalSummaryText">
            Booking for <strong>{bookingDraft.date}</strong> at{" "}
            <strong>{bookingDraft.startTime}</strong>
          </p>

          <div className="formGrid">
            <div className="field">
              <label className="fieldLabel">Name on Card</label>
              <input
                className="input"
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Harshana L. Fernando"
              />
            </div>

            <div className="field">
              <label className="fieldLabel">Card Number</label>
              <input
                className="input"
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
              />
            </div>

            <div className="fieldRow">
              <div className="field">
                <label className="fieldLabel">Expiry</label>
                <input
                  className="input"
                  type="text"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                />
              </div>
              <div className="field">
                <label className="fieldLabel">CVV</label>
                <input
                  className="input"
                  type="password"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="•••"
                />
              </div>
            </div>
          </div>

          <div className="noteBox">
            For demo purposes this payment form is not charging real cards.
          </div>
        </div>

        <div className="modalActions">
          <button
            className="secondaryBtn modalBtn"
            onClick={onBack}
            disabled={loading}
          >
            Back
          </button>
          <button
            className="primaryBtn modalBtn"
            onClick={confirmPayment}
            disabled={loading}
          >
            {loading ? "Processing..." : "Confirm &amp; Reserve Slot"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────
 * Full Booking Page (NO popup)
 * URL: /booking/:bookingId
 * ───────────────────────── */
function BookingPage() {
  const { bookingId } = useParams();
  const location = useLocation();
  const [booking, setBooking] = useState(location.state || null);

  // If we didn't get state (e.g., user refreshed), load from backend
  useEffect(() => {
    if (booking) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    fetch(`http://localhost:5000/api/bookings/${bookingId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setBooking({
            bookingId: data.id,
            slotId: data.slotId,
            date: data.startTime.slice(0, 10),
            startTime: data.startTime.slice(11, 16),
          });
        }
      })
      .catch(console.error);
  }, [booking, bookingId]);

  if (!booking) {
    return (
      <div className="bookingPage">
        <p>Loading your booking...</p>
      </div>
    );
  }

  return (
    <div className="bookingPage">
      <div className="bookingCard">
        <h1 className="bookingTitle">Booking Confirmed</h1>

        <p className="bookingSubtitle">
          Your parking slot <strong>{booking.slotId}</strong> has been reserved
          for <strong>{booking.date}</strong> at{" "}
          <strong>{booking.startTime}</strong>.
        </p>

        <div className="noteBox">
          This is your dedicated slot. Please arrive on time and follow the
          on-site instructions.
        </div>

        <section className="bookingMapSection">
          <div className="bookingMapHeader">
            <h2>Parking</h2>
            <div className="legend">
              <span>
                <span className="legendDot legendAvailable" /> Available
              </span>
              <span>
                <span className="legendDot legendOccupied" /> Occupied
              </span>
            </div>
          </div>

          <div className="summaryMap">
            <ParkingMap selectedSlotLabel={booking.slotId} interactive={false} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────
 * Home Page (landing)
 * ───────────────────────── */
function HomePage() {
  return (
    <>
      <ParkingMap />

      <main className="hero">
        <h1 className="heroTitle">
          Sri Lanka&apos;s Award Winning
          <br />
          <span className="heroTitleDim">Digital Parking Service Provider</span>
        </h1>

        <p className="heroSubtitle">
          Discover smarter, hassle-free parking solutions embodying excellence,
          making us the foremost choice for seamless parking services, ushering
          in the future of parking.
        </p>

        <div className="heroActions">
          <button className="primaryBtn">Reach our Specialist</button>
          <button className="secondaryBtn">Learn More</button>
        </div>
      </main>
    </>
  );
}

/* ─────────────────────────
 * Root App
 * ───────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout children={<HomePage />} />} />
        <Route path="/login" element={<Layout children={<LoginPage />} />} />
        <Route
          path="/register"
          element={<Layout children={<RegisterPage />} />}
        />
        {/* 🔥 New full-page booking view */}
        <Route
          path="/booking/:bookingId"
          element={<Layout children={<BookingPage />} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
