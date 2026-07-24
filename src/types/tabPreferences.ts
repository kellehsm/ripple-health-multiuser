export type ModuleId =
  | 'wellness'
  | 'meals'
  | 'health'
  | 'exercise'
  | 'hobbies'
  | 'finance';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  emoji: string;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { id: 'wellness', label: 'Wellness', emoji: '❤️' },
  { id: 'meals',    label: 'Meals',    emoji: '🍜' },
  { id: 'health',   label: 'Health',   emoji: '💊' },
  { id: 'exercise', label: 'Exercise', emoji: '🏃' },
  { id: 'hobbies',  label: 'Hobbies',  emoji: '📖' },
  { id: 'finance',  label: 'Finance',  emoji: '💳' },
];
// Friends is accessed from the top header bar, not the bottom tab bar.

export const HOME_MODULE = {
  id: 'home' as const,
  label: 'Home',
  emoji: '🏠',
} as const;

export interface HealthSubPreferences {
  medication: boolean;
  cycle: boolean;
}

export interface TabPreferences {
  selectedModules: ModuleId[];
  health: HealthSubPreferences;
}

/** Hard cap: 6 modules + Home = 7 icons total. */
export const MAX_SELECTED_MODULES = 6;

export const DEFAULT_TAB_PREFERENCES: TabPreferences = {
  selectedModules: ['wellness', 'meals', 'hobbies', 'finance'],
  health: { medication: false, cycle: false },
};
