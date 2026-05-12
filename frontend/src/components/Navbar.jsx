import { Link, useNavigate } from "react-router-dom";
import { usePrebook } from "./Prebook/PrebookProvider";
import { useAuth } from "../hooks/useAuth";
import { useLatestBooking } from "../hooks/useLatestBooking";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { APP_EVENTS, emitAppEvent } from "../lib/appEvents";

export default function Navbar() {
  const navigate = useNavigate();
  const { open } = usePrebook();
  const { isLoggedIn } = useAuth();
  const { latestBookingId } = useLatestBooking();

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);

    emitAppEvent(APP_EVENTS.AUTH_CHANGED);
    navigate("/login");
  };

  const goToTracking = () => {
    if (!latestBookingId) return;
    navigate(`/booking/${latestBookingId}`);
  };

  return (
    <header className="nav">
      <div className="navLeft">
        <div className="brand" onClick={() => navigate("/")} role="button" tabIndex={0}>
          <span className="brandBadge">P</span>
          <span className="brandAccent">Park</span>
          <span className="brandWhite">Smart</span>
        </div>

        <nav className="navLinks">
          <button type="button" className="navLinkBtn">
            Bidding
          </button>

          <button type="button" className="navLinkBtn" onClick={open}>
            Pre-book
          </button>

          {/* Tracking */}
          <button
            type="button"
            className={`navLinkBtn ${!latestBookingId ? "navLinkBtnDisabled" : ""}`}
            onClick={goToTracking}
            disabled={!latestBookingId}
            title={!latestBookingId ? "No active booking yet" : "Go to your booking"}
          >
            Tracking
          </button>
        </nav>
      </div>

      <div className="navRight">
        {isLoggedIn ? (
          <>
            <span className="navPill">Logged in</span>
            <button className="primaryBtn authBtn" onClick={logout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className="primaryBtn authBtn" to="/login">
              Login
            </Link>
            <Link className="primaryBtn authBtn" to="/register">
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}