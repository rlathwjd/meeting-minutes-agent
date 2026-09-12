import type { Meridiem } from "../types";

export function getCalendarDays(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  start.setDate(start.getDate() - start.getDay());
  end.setDate(end.getDate() + (6 - end.getDay()));

  const length = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return Array.from({ length }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isSameDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export function toDisplayTime(value: string): { meridiem: Meridiem; timeText: string } {
  const [rawHour, minute = "00"] = value.split(":");
  const hour24 = Number(rawHour);
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return {
    meridiem,
    timeText: `${String(hour12).padStart(2, "0")}:${minute.padStart(2, "0")}`,
  };
}

export function normalizeTimeInput(value: string) {
  const compact = value.trim();
  const match = compact.match(/^(\d{1,2})(?::?(\d{0,2}))?$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number((match[2] || "00").padEnd(2, "0"));
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function to24Hour(meridiem: Meridiem, timeText: string) {
  const [hourText, minute] = timeText.split(":");
  const hour12 = Number(hourText);
  const hour24 = meridiem === "AM" ? hour12 % 12 : (hour12 % 12) + 12;

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function formatKoreanTime(value: string) {
  const display = toDisplayTime(value);
  return `${display.meridiem === "AM" ? "오전" : "오후"} ${display.timeText}`;
}
