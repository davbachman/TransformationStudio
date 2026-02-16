/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react';
import type {
  Category,
  EditorImage,
  EditorState,
  ToolKind,
  TransformPayload,
  TransformStep,
} from '../types/transforms';
import {
  clonePayload,
  createStep,
  liftStepToCategory,
  normalizeStep,
  toolLabel,
} from '../math/transformEval';
import { MAX_STEPS } from '../types/transforms';

interface HistoryState {
  past: EditorState[];
  present: EditorState;
  future: EditorState[];
}

type Action =
  | { type: 'ADD_STEP'; toolKind: ToolKind; category: Category }
  | { type: 'SELECT_STEP'; stepId: string }
  | { type: 'DELETE_STEP'; stepId: string }
  | { type: 'UPDATE_STEP_PAYLOAD'; stepId: string; payload: TransformPayload }
  | { type: 'REORDER_STEPS'; dragId: string; targetId: string }
  | { type: 'SET_IMAGE'; image: EditorImage }
  | { type: 'TOGGLE_SQUARE_GRID' }
  | { type: 'TOGGLE_POLAR_GRID' }
  | { type: 'TOGGLE_HISTORY' }
  | { type: 'SET_ACTIVE_CATEGORY'; category: Category }
  | { type: 'CLICK_CATEGORY'; category: Category }
  | { type: 'UNDO' }
  | { type: 'REDO' };

interface ReduceResult {
  next: EditorState;
  pushHistory: boolean;
}

const initialState: EditorState = {
  image: null,
  steps: [],
  selectedStepId: null,
  activeCategory: 'linear',
  showSquareGrid: false,
  showPolarGrid: false,
  showHistory: true,
};

let stepCounter = 1;

function generateStepId(): string {
  const id = `step-${stepCounter}`;
  stepCounter += 1;
  return id;
}

function cloneState(state: EditorState): EditorState {
  return {
    ...state,
    image: state.image ? { ...state.image } : null,
    steps: state.steps.map((step) => ({
      ...step,
      payload: clonePayload(step.payload),
    })),
  };
}

function pushPast(history: HistoryState, next: EditorState): HistoryState {
  return {
    past: [...history.past, cloneState(history.present)],
    present: next,
    future: [],
  };
}

function moveBefore<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  const insertIndex = toIndex;
  next.splice(insertIndex, 0, item);
  return next;
}

function makeStepLabel(steps: TransformStep[], toolKind: ToolKind, category: Category): string {
  if (toolKind === 'define') {
    const count = steps.filter((step) => step.toolKind === 'define' && step.category === category).length + 1;
    return `Custom (${category}) ${count}`;
  }

  const base = toolLabel(toolKind);
  const count = steps.filter((step) => step.toolKind === toolKind).length + 1;
  return `${base} ${count}`;
}

function reducePresent(state: EditorState, action: Action): ReduceResult {
  switch (action.type) {
    case 'ADD_STEP': {
      if (state.steps.length >= MAX_STEPS) {
        return { next: state, pushHistory: false };
      }

      const label = makeStepLabel(state.steps, action.toolKind, action.category);
      const nextStep = createStep(generateStepId(), label, action.toolKind, action.category);

      return {
        next: {
          ...state,
          steps: [nextStep, ...state.steps],
          selectedStepId: nextStep.id,
          activeCategory: nextStep.category,
        },
        pushHistory: true,
      };
    }

    case 'SELECT_STEP': {
      const selected = state.steps.find((step) => step.id === action.stepId);
      if (!selected || selected.id === state.selectedStepId) {
        return { next: state, pushHistory: false };
      }

      return {
        next: {
          ...state,
          selectedStepId: selected.id,
          activeCategory: selected.category,
        },
        pushHistory: false,
      };
    }

    case 'DELETE_STEP': {
      const deleteIndex = state.steps.findIndex((step) => step.id === action.stepId);
      if (deleteIndex < 0) {
        return { next: state, pushHistory: false };
      }

      const nextSteps = state.steps.filter((step) => step.id !== action.stepId);
      if (state.selectedStepId !== action.stepId) {
        return {
          next: {
            ...state,
            steps: nextSteps,
          },
          pushHistory: true,
        };
      }

      const nextSelected =
        nextSteps.length === 0 ? null : nextSteps[Math.min(deleteIndex, nextSteps.length - 1)].id;
      const selectedStep = nextSelected ? nextSteps.find((step) => step.id === nextSelected) ?? null : null;

      return {
        next: {
          ...state,
          steps: nextSteps,
          selectedStepId: nextSelected,
          activeCategory: selectedStep ? selectedStep.category : state.activeCategory,
        },
        pushHistory: true,
      };
    }

    case 'UPDATE_STEP_PAYLOAD': {
      const index = state.steps.findIndex((step) => step.id === action.stepId);
      if (index < 0) {
        return { next: state, pushHistory: false };
      }

      const current = state.steps[index];
      const updated = normalizeStep({
        ...current,
        payload: clonePayload(action.payload),
      });

      const nextSteps = [...state.steps];
      nextSteps[index] = updated;

      return {
        next: {
          ...state,
          steps: nextSteps,
        },
        pushHistory: true,
      };
    }

    case 'REORDER_STEPS': {
      const from = state.steps.findIndex((step) => step.id === action.dragId);
      const to = state.steps.findIndex((step) => step.id === action.targetId);

      if (from < 0 || to < 0 || from === to) {
        return { next: state, pushHistory: false };
      }

      const nextSteps = moveBefore(state.steps, from, to);

      return {
        next: {
          ...state,
          steps: nextSteps,
        },
        pushHistory: true,
      };
    }

    case 'SET_IMAGE': {
      return {
        next: {
          ...state,
          image: action.image,
        },
        pushHistory: true,
      };
    }

    case 'TOGGLE_SQUARE_GRID': {
      return {
        next: {
          ...state,
          showSquareGrid: !state.showSquareGrid,
        },
        pushHistory: true,
      };
    }

    case 'TOGGLE_POLAR_GRID': {
      return {
        next: {
          ...state,
          showPolarGrid: !state.showPolarGrid,
        },
        pushHistory: true,
      };
    }

    case 'TOGGLE_HISTORY': {
      return {
        next: {
          ...state,
          showHistory: !state.showHistory,
        },
        pushHistory: true,
      };
    }

    case 'SET_ACTIVE_CATEGORY': {
      if (state.activeCategory === action.category) {
        return { next: state, pushHistory: false };
      }
      return {
        next: {
          ...state,
          activeCategory: action.category,
        },
        pushHistory: false,
      };
    }

    case 'CLICK_CATEGORY': {
      const baseState = state.activeCategory === action.category
        ? state
        : { ...state, activeCategory: action.category };

      if (!state.selectedStepId) {
        return {
          next: baseState,
          pushHistory: false,
        };
      }

      const index = baseState.steps.findIndex((step) => step.id === state.selectedStepId);
      if (index < 0) {
        return {
          next: baseState,
          pushHistory: false,
        };
      }

      const current = baseState.steps[index];
      const lifted = liftStepToCategory(current, action.category);
      if (lifted === current) {
        return {
          next: baseState,
          pushHistory: false,
        };
      }

      const nextSteps = [...baseState.steps];
      nextSteps[index] = lifted;

      return {
        next: {
          ...baseState,
          steps: nextSteps,
        },
        pushHistory: true,
      };
    }

    default:
      return { next: state, pushHistory: false };
  }
}

function reducer(history: HistoryState, action: Action): HistoryState {
  if (action.type === 'UNDO') {
    if (history.past.length === 0) {
      return history;
    }
    const previous = history.past[history.past.length - 1];
    const nextPast = history.past.slice(0, -1);
    return {
      past: nextPast,
      present: previous,
      future: [cloneState(history.present), ...history.future],
    };
  }

  if (action.type === 'REDO') {
    if (history.future.length === 0) {
      return history;
    }
    const [nextPresent, ...nextFuture] = history.future;
    return {
      past: [...history.past, cloneState(history.present)],
      present: nextPresent,
      future: nextFuture,
    };
  }

  const result = reducePresent(history.present, action);
  if (result.next === history.present) {
    return history;
  }

  if (result.pushHistory) {
    return pushPast(history, result.next);
  }

  return {
    ...history,
    present: result.next,
  };
}

interface EditorStoreValue {
  state: EditorState;
  canUndo: boolean;
  canRedo: boolean;
  addTool: (toolKind: ToolKind, category: Category) => void;
  selectStep: (stepId: string) => void;
  deleteStep: (stepId: string) => void;
  updateStepPayload: (stepId: string, payload: TransformPayload) => void;
  reorderSteps: (dragId: string, targetId: string) => void;
  setImage: (image: EditorImage) => void;
  toggleSquareGrid: () => void;
  togglePolarGrid: () => void;
  toggleHistory: () => void;
  clickCategory: (category: Category) => void;
  setActiveCategory: (category: Category) => void;
  undo: () => void;
  redo: () => void;
}

const EditorStoreContext = createContext<EditorStoreValue | null>(null);

export function EditorProvider({ children }: PropsWithChildren) {
  const [history, dispatch] = useReducer(reducer, {
    past: [],
    present: initialState,
    future: [],
  });

  const addTool = useCallback((toolKind: ToolKind, category: Category) => {
    dispatch({ type: 'ADD_STEP', toolKind, category });
  }, []);

  const selectStep = useCallback((stepId: string) => {
    dispatch({ type: 'SELECT_STEP', stepId });
  }, []);

  const deleteStep = useCallback((stepId: string) => {
    dispatch({ type: 'DELETE_STEP', stepId });
  }, []);

  const updateStepPayload = useCallback((stepId: string, payload: TransformPayload) => {
    dispatch({ type: 'UPDATE_STEP_PAYLOAD', stepId, payload });
  }, []);

  const reorderSteps = useCallback((dragId: string, targetId: string) => {
    dispatch({ type: 'REORDER_STEPS', dragId, targetId });
  }, []);

  const setImage = useCallback((image: EditorImage) => {
    dispatch({ type: 'SET_IMAGE', image });
  }, []);

  const toggleSquareGrid = useCallback(() => {
    dispatch({ type: 'TOGGLE_SQUARE_GRID' });
  }, []);

  const togglePolarGrid = useCallback(() => {
    dispatch({ type: 'TOGGLE_POLAR_GRID' });
  }, []);

  const toggleHistory = useCallback(() => {
    dispatch({ type: 'TOGGLE_HISTORY' });
  }, []);

  const clickCategory = useCallback((category: Category) => {
    dispatch({ type: 'CLICK_CATEGORY', category });
  }, []);

  const setActiveCategory = useCallback((category: Category) => {
    dispatch({ type: 'SET_ACTIVE_CATEGORY', category });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  const value = useMemo<EditorStoreValue>(
    () => ({
      state: history.present,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      addTool,
      selectStep,
      deleteStep,
      updateStepPayload,
      reorderSteps,
      setImage,
      toggleSquareGrid,
      togglePolarGrid,
      toggleHistory,
      clickCategory,
      setActiveCategory,
      undo,
      redo,
    }),
    [
      addTool,
      clickCategory,
      deleteStep,
      history.future.length,
      history.past.length,
      history.present,
      redo,
      reorderSteps,
      selectStep,
      setActiveCategory,
      setImage,
      toggleHistory,
      togglePolarGrid,
      toggleSquareGrid,
      undo,
      updateStepPayload,
    ],
  );

  return <EditorStoreContext.Provider value={value}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore(): EditorStoreValue {
  const context = useContext(EditorStoreContext);
  if (!context) {
    throw new Error('useEditorStore must be used within EditorProvider');
  }
  return context;
}
