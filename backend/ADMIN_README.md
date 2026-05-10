# Admin Dashboard — Car Park

This adds a separate **admin** account, a **payments** model, and a full
React admin UI at `/admin/*` for monitoring and managing the parking system.

---

## 1. New tables

Two new tables are needed in the database:

- `admins` — admin users (separate from drivers)
- `payments` — payments tied to bookings + users

The seed script below auto-creates both tables via `db.create_all()`.

If you also use Alembic/migrations elsewhere, generate one for these models
(`backend/app/models/admin.py`, `backend/app/models/payment.py`).

---

## 2. Create the first admin

From the `backend/` folder, with your venv active and `DATABASE_URL` set in
`backend/.env`:

```bash
python -m scripts.create_admin --username admin --password "Strong!Pass1" --full-name "Site Admin" --email admin@example.com
```

Re-running with the same `--username` resets the password and updates the
profile fields (it never deletes data).

---

## 3. Routes added

Backend (Flask blueprints):

| Method  | URL                                       | Auth          | Purpose                                              |
| ------- | ----------------------------------------- | ------------- | ---------------------------------------------------- |
| POST    | `/api/payments`                           | user JWT      | Record a payment for a booking (called by PaymentModal) |
| GET     | `/api/payments/by-booking/<id>`           | user JWT      | Latest payment + parking summary for a booking       |
| POST    | `/api/admin/auth/login`                   | public        | Admin login -> admin JWT                             |
| GET     | `/api/admin/auth/me`                      | admin JWT     | Current admin profile                                |
| GET     | `/api/admin/payments/latest?limit=20`     | admin JWT     | Latest payments + parking summary per vehicle        |
| GET     | `/api/admin/bookings?status=&q=&from=&to=` | admin JWT    | List bookings (filter, paginate)                     |
| GET     | `/api/admin/bookings/<id>`                | admin JWT     | Detail (booking + payment + vehicle + slot)          |
| PATCH   | `/api/admin/bookings/<id>/slot`           | admin JWT     | Reassign slot (`{slotId}` or `{slotLabel}`)          |
| GET     | `/api/admin/slots`                        | admin JWT     | All slots with live status (FREE/RESERVED/OCCUPIED/INACTIVE) |
| PATCH   | `/api/admin/slots/<id>`                   | admin JWT     | Toggle active / rename                               |
| GET     | `/api/admin/stats/overview`               | admin JWT     | KPIs                                                 |
| GET     | `/api/admin/stats/occupancy`              | admin JWT     | Slot map (status per slot)                           |
| GET     | `/api/admin/stats/revenue?days=14`        | admin JWT     | Daily revenue                                        |
| GET     | `/api/admin/stats/bookings-per-day?days=14` | admin JWT   | Stacked bookings count by status                     |
| GET     | `/api/admin/stats/vehicle-types`          | admin JWT     | Vehicle type distribution                            |
| GET     | `/api/admin/stats/peak-hours`             | admin JWT     | 7×24 day-of-week × hour heatmap                      |
| GET     | `/api/admin/stats/recent-history?limit=10` | admin JWT    | Latest sessions + average parking time               |

The admin JWT uses `aud: "carpark-admin"`; user JWTs are not accepted by
admin endpoints and vice-versa, so the two auth surfaces stay isolated.

---

## 4. Frontend

Routes in the existing React app:

- `/admin/login`     — admin sign-in
- `/admin`           — dashboard (KPIs, charts, slot map, latest history)
- `/admin/bookings`  — search/filter bookings, reassign slot
- `/admin/slots`     — slot map + activate/deactivate
- `/admin/payments`  — live payment feed + post-payment vehicle summary card

The admin token is stored under `localStorage.adminAuthToken`, separate
from the driver token (`authToken`), so an admin and a driver can be
signed in side-by-side in the same browser.

Charts are written in plain SVG (no extra npm dependency) — just run the
existing `npm start` in `frontend/`.

---

## 5. What the user sees right after paying

`PaymentModal.jsx` now:

1. Confirms the booking (existing behaviour) → gets `bookingId` + `slotId`.
2. Posts a `Payment` row via `POST /api/payments` so it shows up on
   `/admin/payments` immediately.
3. Forwards `paymentSummary` + `amountPaidLkr` to the next screen via
   `onSuccess` so the user (and admin) see the same figures.

Because admins poll `/admin/payments/latest` every 15s and the dashboard
every 30s, the new payment becomes visible essentially in real time.
