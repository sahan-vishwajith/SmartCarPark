// src/lib/pricing.js

export const PRICING = {
  // ✅ Precharge for booking
  baseFee: 30, // LKR

  // Charge per minute once parking started
  perMinute: 5, // LKR per minute

  // ✅ after checkout, user should exit within 15 minutes
  exitGraceMinutes: 15,
};

export function calcAmountLkr({ minutesParked = 0 }) {
  const m = Math.max(0, Math.ceil(minutesParked));
  return PRICING.baseFee + m * PRICING.perMinute;
}