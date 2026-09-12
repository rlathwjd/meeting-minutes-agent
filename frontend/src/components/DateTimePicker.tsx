import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import type { Meridiem } from "../types";
import { formatDateInput, formatKoreanTime, getCalendarDays, isSameDate, normalizeTimeInput, to24Hour, toDisplayTime } from "../lib/date";

export function DateTimePicker(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const pickerRef = React.useRef<HTMLDivElement | null>(null);
  const selectedDate = props.value ? new Date(props.value) : null;
  const today = new Date();
  const initialDisplayTime = toDisplayTime(props.value ? props.value.slice(11, 16) : "09:00");
  const [visibleMonth, setVisibleMonth] = React.useState(
    new Date(selectedDate?.getFullYear() ?? today.getFullYear(), selectedDate?.getMonth() ?? today.getMonth(), 1),
  );
  const [meridiem, setMeridiem] = React.useState<Meridiem>(initialDisplayTime.meridiem);
  const [timeInput, setTimeInput] = React.useState(initialDisplayTime.timeText);

  React.useEffect(() => {
    if (props.value) {
      const nextDate = new Date(props.value);
      const nextTime = toDisplayTime(props.value.slice(11, 16));
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setMeridiem(nextTime.meridiem);
      setTimeInput(nextTime.timeText);
    }
  }, [props.value]);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const days = getCalendarDays(visibleMonth);
  const formattedValue = selectedDate
    ? `${selectedDate.getFullYear()}.${String(selectedDate.getMonth() + 1).padStart(2, "0")}.${String(selectedDate.getDate()).padStart(2, "0")} ${formatKoreanTime(props.value.slice(11, 16))}`
    : "회의 일시를 선택하세요";

  function selectDate(day: Date) {
    const datePart = formatDateInput(day);
    props.onChange(`${datePart}T${to24Hour(meridiem, normalizeTimeInput(timeInput) ?? "09:00")}`);
  }

  function updateMeridiem(nextMeridiem: Meridiem) {
    setMeridiem(nextMeridiem);
    const baseDate = selectedDate ?? today;
    props.onChange(`${formatDateInput(baseDate)}T${to24Hour(nextMeridiem, normalizeTimeInput(timeInput) ?? "09:00")}`);
  }

  function updateTimeInput(nextValue: string) {
    setTimeInput(nextValue);
    const normalized = normalizeTimeInput(nextValue);
    if (!normalized) {
      return;
    }

    const baseDate = selectedDate ?? today;
    props.onChange(`${formatDateInput(baseDate)}T${to24Hour(meridiem, normalized)}`);
  }

  function updateTimePart(part: "hour" | "minute", nextValue: string) {
    const digits = nextValue.replace(/\D/g, "").slice(0, 2);
    const [currentHour, currentMinute] = timeInput.split(":");
    updateTimeInput(part === "hour" ? `${digits}:${currentMinute ?? "00"}` : `${currentHour ?? "09"}:${digits}`);
  }

  function normalizeCurrentTime() {
    const normalized = normalizeTimeInput(timeInput) ?? "09:00";
    setTimeInput(normalized);
    const baseDate = selectedDate ?? today;
    props.onChange(`${formatDateInput(baseDate)}T${to24Hour(meridiem, normalized)}`);
  }

  return (
    <div className="date-picker" ref={pickerRef}>
      <button
        type="button"
        className={`date-trigger ${isOpen ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selectedDate ? "" : "placeholder"}>{formattedValue}</span>
        <CalendarDays size={18} />
      </button>

      {isOpen && (
        <div className="date-menu" role="dialog" aria-label="회의 일시 선택">
          <div className="calendar-header">
            <button
              type="button"
              className="icon-button compact"
              title="이전 달"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
            >
              <ChevronLeft size={17} />
            </button>
            <strong>
              {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
            </strong>
            <button
              type="button"
              className="icon-button compact"
              title="다음 달"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <div className="calendar-weekdays">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {days.map((day) => {
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;
              const isToday = isSameDate(day, today);

              return (
                <button
                  type="button"
                  className={`calendar-day ${isCurrentMonth ? "" : "muted"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
                  key={day.toISOString()}
                  onClick={() => selectDate(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="time-field">
            <span>시간</span>
            <div className="time-manual-row">
              <div className="meridiem-toggle">
                <button type="button" className={meridiem === "AM" ? "selected" : ""} onClick={() => updateMeridiem("AM")}>
                  오전
                </button>
                <button type="button" className={meridiem === "PM" ? "selected" : ""} onClick={() => updateMeridiem("PM")}>
                  오후
                </button>
              </div>
              <div className="time-input-group">
                <input
                  aria-label="회의 시간"
                  inputMode="numeric"
                  placeholder="09"
                  value={timeInput.split(":")[0] ?? ""}
                  onBlur={normalizeCurrentTime}
                  onChange={(event) => updateTimePart("hour", event.target.value)}
                />
                <span>:</span>
                <input
                  aria-label="회의 분"
                  inputMode="numeric"
                  placeholder="30"
                  value={timeInput.split(":")[1] ?? ""}
                  onBlur={normalizeCurrentTime}
                  onChange={(event) => updateTimePart("minute", event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
