import React, { useState, useMemo, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths,
  subMonths
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  LabelList
} from 'recharts';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Activity,
  Zap,
  LayoutGrid,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Minus,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Undo2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { INITIAL_HABITS, type Habit, type HabitCompletion } from './types';

const COLORS = ['#00ffff', 'rgba(255, 255, 255, 0.05)'];

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());

  // ✅ DB-backed state defaults (no localStorage)
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);
  const [completions, setCompletions] = useState<HabitCompletion>({});

  // ✅ prevents saving defaults before we load from DB
  const [hydrated, setHydrated] = useState(false);
  
  // Undo History
  const [history, setHistory] = useState<{ habits: Habit[], completions: HabitCompletion }[]>([]);

  const pushToHistory = (currentHabits: Habit[], currentCompletions: HabitCompletion) => {
    setHistory(prev => {
      const newHistory = [...prev, { habits: JSON.parse(JSON.stringify(currentHabits)), completions: JSON.parse(JSON.stringify(currentCompletions)) }];
      if (newHistory.length > 50) return newHistory.slice(1);
      return newHistory;
    });
  };

  const undo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHabits(lastState.habits);
    setCompletions(lastState.completions);
    setHistory(prev => prev.slice(0, -1));
  };

  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [descriptionWidth, setDescriptionWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX - 32)); // 32 is roughly the padding/offset
      setDescriptionWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // ✅ LOAD from D1 via Pages Function
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        const data = await res.json();

        // if DB is empty {}, keep defaults
        if (data && typeof data === 'object') {
          if (Array.isArray((data as any).habits)) setHabits((data as any).habits);
          if ((data as any).completions && typeof (data as any).completions === 'object') {
            setCompletions((data as any).completions);
          }
        }
      } catch (e) {
        console.warn('Failed to load state from /api/state', e);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // ✅ SAVE to D1 via Pages Function (replaces localStorage)
  useEffect(() => {
    if (!hydrated) return;

    const body = { habits, completions };

    (async () => {
      try {
        await fetch('/api/state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (e) {
        console.warn('Failed to save state to /api/state', e);
      }
    })();
  }, [habits, completions, hydrated]);

  const addHabit = () => {
    if (!newValue.trim()) return;
    pushToHistory(habits, completions);
    const newHabit: Habit = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      name: newValue.trim()
    };
    setHabits(prev => [...prev, newHabit]);
    setNewValue('');
    setIsAdding(false);
  };

  const deleteHabit = (id: string) => {
    pushToHistory(habits, completions);
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const startEditing = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setEditValue(habit.name);
  };

  const saveEdit = () => {
    if (!editValue.trim()) return;
    pushToHistory(habits, completions);
    setHabits(prev => prev.map(h => h.id === editingHabitId ? { ...h, name: editValue.trim() } : h));
    setEditingHabitId(null);
  };

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const cycleHabitState = (date: Date, habitId: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    pushToHistory(habits, completions);
    const dateKey = format(date, 'yyyy-MM-dd');
    setCompletions(prev => {
      const currentStatus = prev[dateKey]?.[habitId];
      let nextStatus: any;
      
      if (!currentStatus) nextStatus = true;
      else if (currentStatus === true) nextStatus = 'skipped';
      else nextStatus = undefined;

      return {
        ...prev,
        [dateKey]: {
          ...(prev[dateKey] || {}),
          [habitId]: nextStatus
        }
      };
    });
  };

  const getHabitStats = (habitId: string) => {
    let count = 0;
    let total = 0;
    
    daysInMonth.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const status = completions[dateKey]?.[habitId];
      if (status !== 'skipped') {
        total += 1;
        if (status === true) count += 1;
      }
    });

    const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
    return { count, total, percentage };
  };

  const dailyProgressData = useMemo(() => {
    return daysInMonth.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayCompletions = completions[dateKey] || {};
      
      let dayTotal = 0;
      let dayCompleted = 0;
      
      habits.forEach(habit => {
        const status = dayCompletions[habit.id];
        if (status !== 'skipped') {
          dayTotal += 1;
          if (status === true) dayCompleted += 1;
        }
      });

      const percentage = dayTotal === 0 ? 0 : Math.round((dayCompleted / dayTotal) * 100);
      return {
        day: format(day, 'd'),
        percentage,
        completed: dayCompleted
      };
    });
  }, [daysInMonth, completions, habits]);

  const monthlyOverallStats = useMemo(() => {
    let totalPossible = 0;
    let totalCompleted = 0;

    daysInMonth.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayCompletions = completions[dateKey] || {};
      
      habits.forEach(habit => {
        const status = dayCompletions[habit.id];
        if (status !== 'skipped') {
          totalPossible += 1;
          if (status === true) totalCompleted += 1;
        }
      });
    });

    const percentage = totalPossible === 0 ? 0 : Math.round((totalCompleted / totalPossible) * 100);
    return {
      completed: percentage,
      incomplete: totalPossible === 0 ? 0 : 100 - percentage
    };
  }, [daysInMonth, habits, completions]);

  const yearlyStats = useMemo(() => {
    const months = [];
    const currentYear = currentDate.getFullYear();
    
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(currentYear, i, 1);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const days = eachDayOfInterval({ start, end });

      let totalPossible = 0;
      let totalCompleted = 0;

      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayCompletions = completions[dateKey] || {};
        habits.forEach(habit => {
          const status = dayCompletions[habit.id];
          if (status !== 'skipped') {
            totalPossible += 1;
            if (status === true) totalCompleted += 1;
          }
        });
      });

      const percentage = totalPossible === 0 ? 0 : Math.round((totalCompleted / totalPossible) * 100);
      months.push({
        name: format(monthDate, 'MMM'),
        fullName: format(monthDate, 'MMMM'),
        percentage,
        totalPossible,
        totalCompleted,
        isFuture: monthDate > new Date()
      });
    }
    return months;
  }, [completions, habits, currentDate]);

  const pieData = [
    { name: 'Completed', value: monthlyOverallStats.completed },
    { name: 'Incomplete', value: monthlyOverallStats.incomplete },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#FFFFFF] selection:bg-[#00ffff] selection:text-black">
      {/* Background Grid Pattern */}
      <div className="fixed inset-0 tech-grid opacity-[0.05] pointer-events-none" />

      <div className="relative z-10 p-4 md:p-8 lg:p-12 max-w-[1800px] mx-auto">
        {/* Header Section */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] opacity-40">
              <Clock size={12} />
              <span>Real-time Discipline Tracking</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter leading-none">
              HABIT<span className="italic font-serif font-light text-[#00ffff]">MASTERY</span>
            </h1>
            <p className="text-sm font-medium opacity-50 leading-relaxed">
              "It's not who I am underneath, but what I do that defines me."
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              disabled={history.length === 0}
              onClick={undo}
              className={cn(
                "btn-secondary flex items-center gap-2",
                history.length === 0 && "opacity-20 cursor-not-allowed"
              )}
            >
              <Undo2 size={14} />
              Undo Action
            </motion.button>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 bg-[#0A0A0A] border border-white/10 p-1 rounded-none shadow-sm"
            >
              <button 
                onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
                className="p-4 hover:bg-[#00ffff] hover:text-black transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="px-8 py-2 flex flex-col items-center min-w-[160px]">
                <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] opacity-70 mb-1">
                  {format(currentDate, 'yyyy')}
                </span>
                <span className="text-xl font-bold tracking-tight uppercase">
                  {format(currentDate, 'MMMM')}
                </span>
              </div>
              <button 
                onClick={() => setCurrentDate(prev => addMonths(prev, 1))}
                className="p-4 hover:bg-[#00ffff] hover:text-black transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </motion.div>
          </div>
        </header>

        {/* Main Content Bento Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Habit Grid - Main Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="xl:col-span-12 bg-[#0A0A0A] border border-white/10 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#0F0F0F]">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <LayoutGrid size={18} />
                  <h2 className="text-sm font-bold uppercase tracking-widest">Daily Matrix</h2>
                </div>
                <button 
                  onClick={() => setIsAdding(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus size={12} />
                  Add Habit
                </button>
              </div>
              <div className="flex items-center gap-4 md:gap-6 text-[10px] font-mono uppercase opacity-50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-white/20" /> <span className="hidden sm:inline">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-[#00ffff]" /> <span className="hidden sm:inline">Done</span>
                </div>
                <div className="flex items-center gap-2">
                  <Minus size={12} /> <span className="hidden sm:inline">Skipped</span>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {isAdding && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-white/10 bg-[#0A0A0A]"
                >
                  <div className="p-6 flex items-center gap-4">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Enter new habit name..."
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addHabit()}
                      className="flex-1 bg-[#141414] border-none px-4 py-2 text-sm font-bold focus:ring-1 focus:ring-[#00ffff] outline-none text-white"
                    />
                    <button 
                      onClick={addHabit}
                      className="p-2 bg-[#00ffff] text-black hover:bg-[#00ffff]/80 transition-all"
                    >
                      <Save size={18} />
                    </button>
                    <button 
                      onClick={() => setIsAdding(false)}
                      className="p-2 border border-white/10 hover:bg-white/5 transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th 
                      style={{ width: `${descriptionWidth}px`, minWidth: `${descriptionWidth}px` }}
                      className="sticky left-0 z-20 bg-[#0F0F0F] p-6 text-left border-r border-white/10 relative group/header"
                    >
                      <span className="col-header">Habit Description</span>
                      <div 
                        onMouseDown={startResizing}
                        className={cn(
                          "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#00ffff]/50 transition-colors z-30",
                          isResizing ? "bg-[#00ffff] w-0.5" : "bg-transparent"
                        )}
                      />
                    </th>
                    {daysInMonth.map(day => (
                      <th key={day.toString()} className={cn(
                        "p-3 text-center min-w-[45px] border-r border-white/5 relative transition-colors duration-500",
                        isSameDay(day, new Date()) && "bg-[#00ffff]/15"
                      )}>
                        <div className="flex flex-col items-center relative z-10">
                          <span className="text-[9px] font-mono opacity-30 mb-1">
                            {format(day, 'EEE').toUpperCase()}
                          </span>
                          <span className={cn(
                            "text-xs font-bold data-value",
                            isSameDay(day, new Date()) ? "text-[#00ffff] drop-shadow-[0_0_12px_rgba(0,255,255,0.8)] underline underline-offset-4" : "opacity-40"
                          )}>
                            {format(day, 'dd')}
                          </span>
                        </div>
                        {isSameDay(day, new Date()) && (
                          <>
                            <div className="absolute inset-0 border-x border-[#00ffff]/30 pointer-events-none" />
                            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#00ffff] shadow-[0_0_10px_#00ffff] pointer-events-none" />
                          </>
                        )}
                      </th>
                    ))}
                    <th className="p-6 text-center border-l border-white/10 bg-[#0F0F0F]">
                      <span className="col-header">Efficiency</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map((habit, idx) => {
                    const stats = getHabitStats(habit.id);
                    return (
                      <tr key={habit.id} className="group hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                        <td 
                          style={{ width: `${descriptionWidth}px`, minWidth: `${descriptionWidth}px` }}
                          className="sticky left-0 z-20 bg-[#0A0A0A] group-hover:bg-[#0F0F0F] p-6 border-r border-white/10"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                              <span className="text-[10px] font-mono opacity-60 w-4">{(idx + 1).toString().padStart(2, '0')}</span>
                              {editingHabitId === habit.id ? (
                                <input 
                                  autoFocus
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                  onBlur={saveEdit}
                                  className="flex-1 bg-[#141414] border-none px-2 py-1 text-sm font-bold outline-none text-white"
                                />
                              ) : (
                                <span className="text-sm font-bold tracking-tight">{habit.name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => startEditing(habit)}
                                className="p-1.5 hover:bg-[#00ffff] hover:text-black transition-all"
                              >
                                <Pencil size={12} />
                              </button>
                              <button 
                                onClick={() => deleteHabit(habit.id)}
                                className="p-1.5 hover:bg-red-600 hover:text-white transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
                        {daysInMonth.map(day => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const status = completions[dateKey]?.[habit.id];
                          return (
                            <td key={day.toString()} className={cn(
                              "p-1 border-r border-white/5 text-center relative transition-colors duration-500",
                              isSameDay(day, new Date()) && "bg-[#00ffff]/[0.05]"
                            )}>
                              <button
                                onClick={(e) => cycleHabitState(day, habit.id, e)}
                                onContextMenu={(e) => cycleHabitState(day, habit.id, e)}
                                className={cn(
                                  "w-9 h-9 transition-all flex items-center justify-center border relative z-10",
                                  status === true 
                                    ? "bg-[#00ffff] border-[#00ffff] text-black shadow-[0_0_20px_rgba(0,255,255,0.5)]" 
                                    : status === 'skipped'
                                      ? "bg-transparent border-transparent opacity-20 hover:opacity-50"
                                      : "bg-transparent border-white/10 text-transparent hover:border-[#00ffff]/40"
                                )}
                              >
                                {status === true && <Check size={14} strokeWidth={4} />}
                                {status === 'skipped' && <Minus size={14} strokeWidth={4} />}
                              </button>
                              {isSameDay(day, new Date()) && (
                                <div className="absolute inset-0 border-x border-[#00ffff]/15 pointer-events-none" />
                              )}
                            </td>
                          );
                        })}
                        <td className="p-6 bg-[#0F0F0F]/80 border-l border-white/10">
                          <div className="flex items-center justify-between gap-4 min-w-[120px]">
                            <span className="text-xs font-mono font-bold">{stats.percentage}%</span>
                            <div className="flex-1 h-[2px] bg-white/10 overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.percentage}%` }}
                                className="h-full bg-[#00ffff]"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Stats Bento Section */}
          <div className="xl:col-span-8 space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#0A0A0A] border border-white/10 p-8"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={16} />
                    Performance Curve
                  </h3>
                  <p className="text-xs opacity-30 font-mono">Daily completion percentage across all metrics</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#00ffff]" />
                  <span className="text-[10px] font-mono uppercase opacity-30">Efficiency</span>
                </div>
              </div>
              
              <div className="overflow-x-auto custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <div className="h-[300px] min-w-[600px] md:min-w-0 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyProgressData}>
                    <defs>
                      <linearGradient id="colorPerc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00ffff" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#00ffff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#FFFFFF', opacity: 0.3, fontWeight: 600, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#FFFFFF', opacity: 0.3, fontWeight: 600, fontFamily: 'JetBrains Mono' }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0A0A0A', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '0px',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono'
                      }}
                      itemStyle={{ color: '#00ffff' }}
                      cursor={{ stroke: '#00ffff', strokeWidth: 1, opacity: 0.2 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="percentage" 
                      stroke="#00ffff" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorPerc)" 
                      animationDuration={1500}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

            {/* Yearly Overview - 12 Months Summary */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-[#0A0A0A] border border-white/10 p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={16} className="text-[#00ffff]" />
                    Annual Discipline Matrix
                  </h3>
                  <p className="text-xs opacity-30 font-mono">12-month performance distribution</p>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <div className="h-[300px] min-w-[600px] md:min-w-0 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyStats} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                    />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-[#0F0F0F] border border-[#00ffff]/30 p-3 shadow-2xl">
                              <p className="text-[10px] font-mono uppercase opacity-40 mb-1">{data.fullName}</p>
                              <p className="text-sm font-bold text-[#00ffff]">{data.percentage}% Efficiency</p>
                              <p className="text-[9px] opacity-30 mt-1">{data.totalCompleted} / {data.totalPossible} Tasks</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: 'rgba(0, 255, 255, 0.03)' }}
                    />
                    <Bar 
                      dataKey="percentage" 
                      fill="#00ffff" 
                      radius={[2, 2, 0, 0]}
                      barSize={40}
                      animationDuration={1500}
                    >
                      <LabelList 
                        dataKey="percentage" 
                        position="top" 
                        fill="rgba(255,255,255,0.7)" 
                        fontSize={10} 
                        fontFamily="monospace"
                        formatter={(val: number) => val > 0 ? `${val}%` : ''}
                      />
                      {yearlyStats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.name === format(new Date(), 'MMM') ? '#00ffff' : 'rgba(0, 255, 255, 0.2)'}
                          className="transition-all duration-500 hover:fill-[#00ffff]"
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>

          {/* Monthly Summary Pie - Sidebar Panel */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="xl:col-span-4 bg-[#0A0A0A] border border-white/10 p-8 self-start"
          >
            <div className="space-y-1 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest">Monthly Quota</h3>
              <p className="text-xs opacity-30 font-mono">Distribution of completed tasks</p>
            </div>
            
            <div className="flex flex-col items-center justify-start mt-4">
              <div className="relative h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#00ffff' : 'rgba(255,255,255,0.05)'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold tracking-tighter text-[#00ffff]">{monthlyOverallStats.completed}%</span>
                  <span className="text-[10px] font-mono uppercase opacity-30 mt-1">{format(currentDate, 'MMMM')} Yield</span>
                </div>
              </div>

              <div className="w-full mt-6 border border-white/10 overflow-hidden">
                <div className="bg-white/5 py-2 px-4 border-b border-white/10 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Monthly Progress</span>
                </div>
                
                <div className="grid grid-cols-[100px_1fr_60px] items-center border-b border-white/10">
                  <div className="px-4 py-3 border-r border-white/10 text-[10px] font-bold uppercase tracking-widest">Completed</div>
                  <div className="px-4 py-3 border-r border-white/10">
                    <div className="h-3 bg-white/5 relative overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${monthlyOverallStats.completed}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-y-0 left-0 bg-[#00ffff]"
                      />
                    </div>
                  </div>
                  <div className="px-4 py-3 text-right text-[10px] font-mono font-bold text-[#00ffff]">{monthlyOverallStats.completed}%</div>
                </div>

                <div className="grid grid-cols-[100px_1fr_60px] items-center">
                  <div className="px-4 py-3 border-r border-white/10 text-[10px] font-bold uppercase tracking-widest">Incompleted</div>
                  <div className="px-4 py-3 border-r border-white/10">
                    <div className="h-3 bg-white/5 relative overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${monthlyOverallStats.incomplete}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-y-0 left-0 bg-white/20"
                      />
                    </div>
                  </div>
                  <div className="px-4 py-3 text-right text-[10px] font-mono font-bold">{monthlyOverallStats.incomplete}%</div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>

      {/* Footer Details */}
      <footer className="relative z-10 border-t border-white/10 mt-24 py-12 bg-[#0A0A0A]">
        <div className="max-w-[1800px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase opacity-30">System Status</span>
              <span className="text-xs font-bold flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operational
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-mono uppercase opacity-30">Data Integrity</span>
              <span className="text-xs font-bold">Verified</span>
            </div>
          </div>
          
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-20">
            Precision Habit Dashboard v3.0.0
          </div>
        </div>
      </footer>
    </div>
  );
}
