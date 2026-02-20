import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import ParkingMap from "../components/ParkingMap";
import { apiFetch } from "../lib/api";
import { getToken } from "../lib/auth";
import { useBookingTracking } from "../hooks/useBookingTracking";

export default function BookingPage() {
  const { bookingId } = useParams();
  const location = useLocation();
  const [booking, setBooking] = useState(location.state || null);

  // ✅ Live tracking via WebSocket (reconnects automatically)
  const tracking = useBookingTracking(bookingId);

  useEffect(() => {
    if (booking) return;

    const token = getToken();
    if (!token) return;

    apiFetch(`/api/bookings/${bookingId}`, { token })
      .then((data) => {
        setBooking({
          bookingId: data.id,
          slotId: data.slotId,
          date: data.startTime.slice(0, 10),
          startTime: data.startTime.slice(11, 16),
        });
      })
      .catch(() => {});
  }, [booking, bookingId]);

  if (!booking)
    return (
      <div className="bookingPage">
        <p>Loading your booking...</p>
      </div>
    );

  const showRoute = tracking.driverArrived && !tracking.slotOccupied;

  return (
    <div className="bookingPage">
      <div className="bookingCard">
        <h1 className="bookingTitle">Booking Confirmed</h1>

        <p className="bookingSubtitle">
          Your slot <strong>{booking.slotId}</strong> is reserved for{" "}
          <strong>{booking.date}</strong> at <strong>{booking.startTime}</strong>.
        </p>

        <div className="noteBox">
          {tracking.connected ? "Live tracking connected ✅" : "Connecting live tracking…"}
          <br />
          Driver arrived: <strong>{String(tracking.driverArrived)}</strong> | Slot occupied:{" "}
          <strong>{String(tracking.slotOccupied)}</strong>
        </div>

        <section className="bookingMapSection">
          <div className="summaryMap">
            <ParkingMap
              selectedSlotLabel={booking.slotId}
              interactive={false}
              tracking={tracking}
              showRoute={showRoute}
            />
          </div>
        </section>
      </div>
    </div>
  );
}