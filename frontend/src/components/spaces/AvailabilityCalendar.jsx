import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  isAfter,
  startOfDay,
  endOfDay,
  addMinutes,
  addDays,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  differenceInCalendarDays,
} from 'date-fns';
import { cn } from '../../lib/utils';

/**
 * 30-minute interval options for HOUR-priced spaces
 * 06:00 to 22:30
 */
const TIME_SLOTS = [];
for (let h = 6; h <= 22; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}
TIME_SLOTS.push('23:00');

/**
 * Availability Calendar
 * Built without heavy external calendar libraries.
 * Handles DAY range selection with hover preview and HOUR single-day time slot selection.
 * Fully keyboard accessible with ARIA grid roles.
 */
export function AvailabilityCalendar({
  priceUnit = 'DAY',
  blockedIntervals = [],
  value = { startAt: null, endAt: null },
  onChange,
  className = '',
}) {
  const isDayMode = priceUnit === 'DAY';
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => startOfDay(new Date()), []);
  const minLeadTime = useMemo(() => addMinutes(new Date(), 30), []);

  // Current month displayed in the calendar
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value.startAt) {
      return startOfMonth(new Date(value.startAt));
    }
    return startOfMonth(new Date());
  });

  // Range selection states for DAY mode
  const [hoverDate, setHoverDate] = useState(null);

  // Time selections for HOUR mode
  const [selectedDay, setSelectedDay] = useState(() => {
    if (value.startAt) {
      return startOfDay(new Date(value.startAt));
    }
    return null;
  });

  const [startTime, setStartTime] = useState(() => {
    if (value.startAt) {
      return format(new Date(value.startAt), 'HH:mm');
    }
    return '10:00';
  });

  const [endTime, setEndTime] = useState(() => {
    if (value.endAt) {
      return format(new Date(value.endAt), 'HH:mm');
    }
    return '12:00';
  });

  // Normalized blocked intervals
  const normalizedBlocks = useMemo(() => {
    return (blockedIntervals || []).map((b) => ({
      start: new Date(b.startAt),
      end: new Date(b.endAt),
    }));
  }, [blockedIntervals]);

  // Check if a given calendar day is completely blocked
  const isDayBlocked = (day) => {
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);

    // Past days are blocked
    if (isBefore(dayStart, today)) return true;

    // Check overlap with blocked intervals
    return normalizedBlocks.some(
      (b) => isBefore(b.start, dayEnd) && isAfter(b.end, dayStart)
    );
  };

  // Check if an interval [start, end] intersects any blocked interval
  const isRangeBlocked = (startDate, endDate) => {
    return normalizedBlocks.some(
      (b) => isBefore(b.start, endDate) && isAfter(b.end, startDate)
    );
  };

  // Calendar matrix calculations
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Navigation handlers
  const handlePrevMonth = () => {
    const prev = subMonths(currentMonth, 1);
    if (!isBefore(endOfMonth(prev), today)) {
      setCurrentMonth(prev);
    }
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Parse current range values
  const currentStartDate = value.startAt ? startOfDay(new Date(value.startAt)) : null;
  const currentEndDate = value.endAt ? startOfDay(new Date(value.endAt)) : null;

  // DAY Mode: Click day handler
  const handleDayClick = (day) => {
    if (isDayBlocked(day)) return;

    if (!currentStartDate || (currentStartDate && currentEndDate)) {
      // Step 1: Pick start date
      const startAt = setMilliseconds(setSeconds(setMinutes(setHours(day, 10), 0), 0), 0);
      onChange({ startAt: startAt.toISOString(), endAt: null });
    } else if (currentStartDate && !currentEndDate) {
      // Step 2: Pick end date
      if (isBefore(day, currentStartDate)) {
        // Clicked before start: treat as new start date
        const startAt = setMilliseconds(setSeconds(setMinutes(setHours(day, 10), 0), 0), 0);
        onChange({ startAt: startAt.toISOString(), endAt: null });
        return;
      }

      if (isSameDay(day, currentStartDate)) {
        // Same day -> minimum 1 day booking
        const startAt = setMilliseconds(setSeconds(setMinutes(setHours(currentStartDate, 10), 0), 0), 0);
        const endAt = setMilliseconds(setSeconds(setMinutes(setHours(addDays(currentStartDate, 1), 10), 0), 0), 0);
        if (isRangeBlocked(startAt, endAt)) return;
        onChange({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
        return;
      }

      // Check max 30 days
      const daysCount = differenceInCalendarDays(day, currentStartDate);
      if (daysCount > 30) return;

      const startAt = setMilliseconds(setSeconds(setMinutes(setHours(currentStartDate, 10), 0), 0), 0);
      const endAt = setMilliseconds(setSeconds(setMinutes(setHours(day, 10), 0), 0), 0);

      // Verify no blocked days in range
      if (isRangeBlocked(startAt, endAt)) return;

      onChange({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
    }
  };

  // HOUR Mode: Day click handler
  const handleHourDayClick = (day) => {
    if (isDayBlocked(day)) return;
    setSelectedDay(day);

    // Apply current selected time slots with newly selected day
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startAt = setMilliseconds(setSeconds(setMinutes(setHours(day, startH), startM), 0), 0);
    const endAt = setMilliseconds(setSeconds(setMinutes(setHours(day, endH), endM), 0), 0);

    if (isAfter(endAt, startAt) && !isRangeBlocked(startAt, endAt) && !isBefore(startAt, minLeadTime)) {
      onChange({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
    } else {
      onChange({ startAt: null, endAt: null });
    }
  };

  // HOUR Mode: Time change handler
  const handleTimeChange = (newStartTime, newEndTime) => {
    setStartTime(newStartTime);
    setEndTime(newEndTime);

    if (!selectedDay) return;

    const [startH, startM] = newStartTime.split(':').map(Number);
    const [endH, endM] = newEndTime.split(':').map(Number);

    const startAt = setMilliseconds(setSeconds(setMinutes(setHours(selectedDay, startH), startM), 0), 0);
    const endAt = setMilliseconds(setSeconds(setMinutes(setHours(selectedDay, endH), endM), 0), 0);

    if (isAfter(endAt, startAt) && !isRangeBlocked(startAt, endAt) && !isBefore(startAt, minLeadTime)) {
      onChange({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
    } else {
      onChange({ startAt: null, endAt: null });
    }
  };

  // Check if a specific time slot on selectedDay is available
  const isTimeSlotValid = (slotStr, isEndSlot = false) => {
    if (!selectedDay) return false;
    const [h, m] = slotStr.split(':').map(Number);
    const candidate = setMilliseconds(setSeconds(setMinutes(setHours(selectedDay, h), m), 0), 0);

    if (!isEndSlot && isBefore(candidate, minLeadTime)) {
      return false; // Violates 30 min advance notice
    }

    return true;
  };

  const isPrevDisabled = isBefore(endOfMonth(subMonths(currentMonth, 1)), today);

  return (
    <div className={cn('bg-card rounded-2xl border border-border p-4 sm:p-5 select-none', className)}>
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-serif font-bold text-ink text-base">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={isPrevDisabled}
            className="p-1.5 rounded-lg border border-border text-ink hover:bg-sand disabled:opacity-30 disabled:pointer-events-none transition-colors focus-ring"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-border text-ink hover:bg-sand transition-colors focus-ring"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center mb-2" role="row">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="text-2xs font-bold uppercase tracking-wider text-body/80 py-1" role="columnheader">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Month availability grid">
        {calendarDays.map((day) => {
          const isCurrentMonthDay = isSameMonth(day, currentMonth);
          const blocked = isDayBlocked(day);
          const isDayToday = isSameDay(day, now);

          let isSelected = false;
          let isInRange = false;
          let isRangeStart = false;
          let isRangeEnd = false;

          if (isDayMode) {
            if (currentStartDate && isSameDay(day, currentStartDate)) {
              isSelected = true;
              isRangeStart = true;
            }
            if (currentEndDate && isSameDay(day, currentEndDate)) {
              isSelected = true;
              isRangeEnd = true;
            }
            if (currentStartDate && currentEndDate) {
              if (isAfter(day, currentStartDate) && isBefore(day, currentEndDate)) {
                isInRange = true;
              }
            } else if (currentStartDate && hoverDate && isAfter(hoverDate, currentStartDate)) {
              if (isAfter(day, currentStartDate) && (isBefore(day, hoverDate) || isSameDay(day, hoverDate))) {
                isInRange = true;
              }
            }
          } else {
            // Hour mode: single day selection
            if (selectedDay && isSameDay(day, selectedDay)) {
              isSelected = true;
            }
          }

          return (
            <div key={day.toISOString()} role="gridcell" className="relative p-0.5">
              <button
                type="button"
                disabled={blocked || !isCurrentMonthDay}
                onClick={() => (isDayMode ? handleDayClick(day) : handleHourDayClick(day))}
                onMouseEnter={() => isDayMode && setHoverDate(day)}
                onMouseLeave={() => isDayMode && setHoverDate(null)}
                aria-label={`${format(day, 'EEEE, d MMMM yyyy')}${blocked ? ', unavailable' : ''}${isSelected ? ', selected' : ''}`}
                aria-selected={isSelected || isInRange}
                aria-disabled={blocked || !isCurrentMonthDay}
                className={cn(
                  'w-full aspect-square rounded-xl text-xs font-medium flex items-center justify-center transition-all focus-ring relative',
                  !isCurrentMonthDay && 'invisible pointer-events-none',
                  blocked && 'text-body/30 line-through cursor-not-allowed bg-sand/30',
                  !blocked && !isSelected && !isInRange && 'text-ink hover:bg-sand active:scale-95',
                  isInRange && 'bg-primary/10 text-primary-hover rounded-none font-semibold',
                  isSelected && 'bg-primary text-white font-bold shadow-warm-xs scale-105 z-10',
                  isRangeStart && 'rounded-r-none rounded-l-xl',
                  isRangeEnd && 'rounded-l-none rounded-r-xl',
                  isDayToday && !isSelected && 'border border-primary text-primary font-bold'
                )}
              >
                <span>{format(day, 'd')}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Range Status / Hour Selectors */}
      {isDayMode ? (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-body">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            <span>
              {currentStartDate && currentEndDate
                ? `${format(currentStartDate, 'dd MMM')} – ${format(currentEndDate, 'dd MMM')}`
                : currentStartDate
                ? 'Select checkout date'
                : 'Select check-in date'}
            </span>
          </div>

          {currentStartDate && currentEndDate && (
            <span className="font-semibold text-primary">
              {differenceInCalendarDays(currentEndDate, currentStartDate)} night(s)
            </span>
          )}
        </div>
      ) : (
        /* Hour Mode Time Pickers */
        <div className="mt-4 pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Select Times</span>
            </span>
            {selectedDay && (
              <span className="text-xs text-body font-medium">
                {format(selectedDay, 'EEE, dd MMM')}
              </span>
            )}
          </div>

          {!selectedDay ? (
            <p className="text-xs text-body italic">Please pick a date on the calendar first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-2xs font-semibold text-body block mb-1">Start Time</label>
                <select
                  value={startTime}
                  onChange={(e) => handleTimeChange(e.target.value, endTime)}
                  className="w-full text-xs rounded-xl border border-border bg-card px-2.5 py-2 text-ink focus-ring cursor-pointer"
                >
                  {TIME_SLOTS.slice(0, -1).map((slot) => {
                    const valid = isTimeSlotValid(slot, false);
                    return (
                      <option key={slot} value={slot} disabled={!valid}>
                        {slot} {!valid ? '(Unavailable)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-2xs font-semibold text-body block mb-1">End Time</label>
                <select
                  value={endTime}
                  onChange={(e) => handleTimeChange(startTime, e.target.value)}
                  className="w-full text-xs rounded-xl border border-border bg-card px-2.5 py-2 text-ink focus-ring cursor-pointer"
                >
                  {TIME_SLOTS.filter((slot) => slot > startTime).map((slot) => {
                    const valid = isTimeSlotValid(slot, true);
                    return (
                      <option key={slot} value={slot} disabled={!valid}>
                        {slot} {!valid ? '(Unavailable)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
