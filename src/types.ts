export interface Habit {
  id: string;
  name: string;
}

export type HabitStatus = boolean | 'skipped' | undefined;

export interface HabitCompletion {
  [date: string]: {
    [habitId: string]: HabitStatus;
  };
}

export const INITIAL_HABITS: Habit[] = [
  { id: '1', name: 'Get up at 5:00 AM' },
  { id: '2', name: 'All prayers in time' },
  { id: '3', name: 'Study for govt 1 hour' },
  { id: '4', name: 'Road to Data Analyst 2 hours' },
  { id: '5', name: 'Business plan and execute 2 hours' },
  { id: '6', name: 'MMA (Sat, Sun)' },
  { id: '7', name: 'Being reserve' },
  { id: '8', name: 'GYM' },
  { id: '9', name: 'Shower' },
  { id: '10', name: 'Daily task' },
  { id: '11', name: 'Project' },
  { id: '12', name: 'Perseverance' },
  { id: '13', name: 'No screentime & social accounts' },
  { id: '14', name: 'No waste of time' },
  { id: '15', name: 'Sleep at 11:00 PM' },
];
