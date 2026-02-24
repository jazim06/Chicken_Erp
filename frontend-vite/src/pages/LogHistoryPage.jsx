import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isBefore,
  isAfter,
  addMonths,
  subMonths,
} from 'date-fns';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Calendar } from '../components/ui/calendar';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';
import { getEntryDates, getSuppliers } from '../utils/apiAdapter';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';

// --------------------------------------------------------
// Page component
// --------------------------------------------------------

const LogHistoryPage = () => {
  const navigate = useNavigate();
  const { lastSupplierId } = useAppContext();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entryDates, setEntryDates] = useState([]); // ['2026-02-01', ...]
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('all');

  // ---- load suppliers for filter ----
  useEffect(() => {
    getSuppliers()
      .then((data) => setSuppliers(data))
      .catch(() => {});
  }, []);

  // ---- load entry dates when month or supplier changes ----
  const fetchDates = useCallback(async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      const sid = selectedSupplierId === 'all' ? null : selectedSupplierId;
      const data = await getEntryDates(start, end, sid);
      setEntryDates(data.dates || []);
    } catch (err) {
      console.error('Failed to load entry dates:', err);
      setEntryDates([]);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, selectedSupplierId]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  // ---- derived data ----
  const entryDateSet = useMemo(() => new Set(entryDates), [entryDates]);

  const entryDateObjects = useMemo(
    () => entryDates.map((d) => new Date(d + 'T00:00:00')),
    [entryDates]
  );

  const daysInMonth = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
    return days.length;
  }, [currentMonth]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayHasEntry = entryDateSet.has(todayStr);

  // ---- handlers ----
  const handleDateClick = (date) => {
    if (!date) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (entryDateSet.has(dateStr)) {
      const suppId = lastSupplierId || 'default';
      navigate(`/supplier/${suppId}/dashboard?date=${dateStr}`);
    }
  };

  const handlePrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  // ---- modifiers for calendar ----
  const today = new Date();
  const missedDays = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
    return days
      .filter((d) => !isAfter(d, today) && !entryDateSet.has(format(d, 'yyyy-MM-dd')))
      .map((d) => d);
  }, [currentMonth, entryDateSet, today]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-wide text-foreground">
              LOG HISTORY
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your daily data entry streak
            </p>
          </div>

          {/* Supplier filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={CheckCircle2}
            label="Days Logged"
            value={`${entryDates.length} / ${daysInMonth}`}
            color="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
          <StatCard
            icon={todayHasEntry ? CheckCircle2 : XCircle}
            label="Today"
            value={todayHasEntry ? 'Entered' : 'Not yet'}
            color={todayHasEntry ? 'text-emerald-500' : 'text-red-500'}
            bgColor={todayHasEntry ? 'bg-emerald-500/10' : 'bg-red-500/10'}
          />
        </div>

        {/* Calendar */}
        <Card className="p-4 md:p-6 card-elevated">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-heading font-bold tracking-wide">
              {format(currentMonth, 'MMMM yyyy').toUpperCase()}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              disabled={isAfter(startOfMonth(addMonths(currentMonth, 1)), today)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Calendar
              mode="single"
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              selected={null}
              onSelect={handleDateClick}
              modifiers={{
                hasEntry: entryDateObjects,
                missed: missedDays,
              }}
              modifiersClassNames={{
                hasEntry:
                  'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold ring-2 ring-emerald-500/40 hover:ring-emerald-500',
                missed: '',
              }}
              disabled={(date) => isAfter(date, today)}
              className="w-full"
              classNames={{
                months: 'flex flex-col sm:flex-row gap-4 w-full',
                month: 'w-full',
                table: 'w-full border-collapse',
                head_row: 'flex w-full',
                head_cell:
                  'text-muted-foreground rounded-md w-full font-medium text-[0.8rem] py-2',
                row: 'flex w-full mt-1',
                cell: cn(
                  'relative w-full p-0 text-center text-sm focus-within:relative focus-within:z-20',
                  '[&:has([aria-selected])]:bg-accent'
                ),
                day: cn(
                  'h-10 w-full rounded-lg p-0 font-normal transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'aria-selected:opacity-100'
                ),
                day_today:
                  'border-2 border-primary text-primary font-bold',
              }}
            />
          )}

          {/* Legend */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-500/40 ring-2 ring-emerald-500/40" />
              Data entered
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-primary" />
              Today
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-muted" />
              No data
            </div>
          </div>
        </Card>

        {/* Recent entries list */}
        <Card className="p-4 md:p-6 card-elevated">
          <h3 className="text-sm font-heading font-bold tracking-wide uppercase text-muted-foreground mb-3">
            Recent Entries — {format(currentMonth, 'MMMM yyyy')}
          </h3>
          {entryDates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No entries found for this month.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {[...entryDates].reverse().map((dateStr) => {
                const d = new Date(dateStr + 'T00:00:00');
                return (
                  <li
                    key={dateStr}
                    className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-accent/50 px-2 rounded-lg transition-colors"
                    onClick={() => handleDateClick(d)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                        <CalendarDays className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {format(d, 'EEEE, MMMM d')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isToday(d) ? 'Today' : format(d, 'yyyy-MM-dd')}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Logged
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

// --------------------------------------------------------
// Small stat card
// --------------------------------------------------------
const StatCard = ({ icon: Icon, label, value, color, bgColor }) => (
  <Card className="p-4 card-elevated">
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
          bgColor
        )}
      >
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-base font-bold font-heading tracking-wide">{value}</p>
      </div>
    </div>
  </Card>
);

export default LogHistoryPage;
