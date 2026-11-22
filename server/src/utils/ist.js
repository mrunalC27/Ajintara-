// ALL date and time work goes through this file. Nothing else should touch time zones.
// Stay dates are stored as plain "YYYY-MM-DD" strings (calendar days in India).
// Real moments (check-in / check-out) are stored as normal UTC Dates.
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const IST = 'Asia/Kolkata';
export const CHECK_IN_TIME = '14:00'; // 2 PM IST
export const CHECK_OUT_TIME = '12:00'; // 12 PM IST

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  return typeof value === 'string' && DATE_RE.test(value) && dayjs(value).isValid();
}

// Today's date in India, like "2026-11-22"
export function todayIST() {
  return dayjs().tz(IST).format('YYYY-MM-DD');
}

// The exact moment a guest can check in (2 PM IST) on a given date
export function checkInMoment(dateString) {
  return dayjs.tz(`${dateString} ${CHECK_IN_TIME}`, IST).toDate();
}

// The exact moment a guest must check out (12 PM IST) on a given date
export function checkOutMoment(dateString) {
  return dayjs.tz(`${dateString} ${CHECK_OUT_TIME}`, IST).toDate();
}

// List of nights for a stay. checkIn "2026-12-24", checkOut "2026-12-26" -> ["2026-12-24", "2026-12-25"]
// (the check-out day itself is NOT a night)
export function nightsBetween(checkInDate, checkOutDate) {
  const nights = [];
  let day = dayjs(checkInDate);
  const end = dayjs(checkOutDate);
  while (day.isBefore(end, 'day')) {
    nights.push(day.format('YYYY-MM-DD'));
    day = day.add(1, 'day');
  }
  return nights;
}

// Show any moment in IST, whatever the server or browser time zone is
export function formatIST(date, format = 'DD MMM YYYY, hh:mm A') {
  return dayjs(date).tz(IST).format(format);
}
