import { z } from 'zod';
import { RULES } from '../config/rules.js';
import { isValidDateString, todayIST, addDaysIST, nightsBetween } from '../utils/ist.js';

export const dateString = z
  .string()
  .refine(isValidDateString, 'Use the date format YYYY-MM-DD, for example 2026-12-24');

// The last date we have room rows for
export function lastInventoryDate() {
  return addDaysIST(todayIST(), RULES.INVENTORY_DAYS - 1);
}

// Returns a list of problems with a stay (empty list = fine).
// "today" can be passed in so tests don't depend on the real date.
export function stayProblems(checkIn, checkOut, today = todayIST()) {
  const problems = [];
  if (checkIn < today) problems.push('Check-in cannot be in the past');
  if (checkOut <= checkIn) {
    problems.push('Check-out must be after check-in');
    return problems;
  }
  if (nightsBetween(checkIn, checkOut).length > RULES.MAX_NIGHTS) {
    problems.push(`You can stay at most ${RULES.MAX_NIGHTS} nights`);
  }
  const lastNight = addDaysIST(checkOut, -1);
  if (lastNight > addDaysIST(today, RULES.INVENTORY_DAYS - 1)) {
    problems.push(`We only take bookings up to ${RULES.INVENTORY_DAYS} days ahead`);
  }
  return problems;
}

// Use inside a zod superRefine to attach stay problems to the checkOut field
export function addStayIssues(checkIn, checkOut, ctx) {
  for (const message of stayProblems(checkIn, checkOut)) {
    ctx.addIssue({ code: 'custom', message, path: ['checkOut'] });
  }
}
