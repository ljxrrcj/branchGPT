import { create } from 'zustand';
import type { ViewMode, ViewState, Viewport, ZoomPhase } from '@/types/view';

const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 1,
  zoomPhase: 'snap',
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2;
const SNAP_ZOOM_THRESHOLD = 0.5;
const ZOOM_STEP = 0.1;

interface ViewStoreState extends ViewState {
  // Actions
  setViewMode: (mode: ViewMode) => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  handleZoom: (delta: number, isCtrl: boolean) => void;
  handlePan: (deltaX: number, deltaY: number) => void;
  selectNode: (nodeId: string | null) => void;
  toggleInputVisibility: (visible?: boolean) => void;
  resetViewport: () => void;
}

export const useViewStore = create<ViewStoreState>((set, _get) => ({
  mode: 'chat',
  viewport: { ...DEFAULT_VIEWPORT },
  isInputVisible: true,
  focusRatio: 0.8,
  selectedNodeId: null,

  setViewMode: (mode) => {
    set((state) => {
      // Automatically show/hide input based on mode
      const isInputVisible = mode !== 'overview';

      return {
        mode,
        isInputVisible,
        // Reset zoom phase when changing modes
        viewport: {
          ...state.viewport,
          zoomPhase: mode === 'overview' ? 'free' : 'snap',
        },
      };
    });
  },

  setViewport: (viewportUpdate) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewportUpdate },
    }));
  },

  handleZoom: (delta, isCtrl) => {
    set((state) => {
      const currentZoom = state.viewport.zoom;
      const zoomChange = delta > 0 ? -ZOOM_STEP : ZOOM_STEP;
      let newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + zoomChange));

      // Determine zoom phase
      let newZoomPhase: ZoomPhase = state.viewport.zoomPhase;
      let newMode = state.mode;

      if (isCtrl) {
        // Ctrl+scroll enables free zoom mode and switches to overview when zoomed out
        if (newZoom < SNAP_ZOOM_THRESHOLD) {
          newMode = 'overview';
          newZoomPhase = 'free';
        } else if (state.mode === 'overview' && newZoom >= 1) {
          // Zooming back in from overview goes to chat or branch mode
          newMode = 'chat';
          newZoomPhase = 'snap';
          newZoom = 1;
        }
      }

      return {
        mode: newMode,
        viewport: {
          ...state.viewport,
          zoom: newZoom,
          zoomPhase: newZoomPhase,
        },
        isInputVisible: newMode !== 'overview',
      };
    });
  },

  handlePan: (deltaX, deltaY) => {
    set((state) => ({
      viewport: {
        ...state.viewport,
        x: state.viewport.x + deltaX,
        y: state.viewport.y + deltaY,
      },
    }));
  },

  selectNode: (nodeId) => {
    set((state) => {
      // Selecting a node switches to chat mode focused on that node
      if (nodeId && state.mode === 'overview') {
        return {
          selectedNodeId: nodeId,
          mode: 'chat',
          isInputVisible: true,
          viewport: {
            ...state.viewport,
            zoom: 1,
            zoomPhase: 'snap',
          },
        };
      }

      return { selectedNodeId: nodeId };
    });
  },

  toggleInputVisibility: (visible?: boolean) => {
    set((state) => ({
      isInputVisible: visible ?? !state.isInputVisible,
    }));
  },

  resetViewport: () => {
    set({
      viewport: { ...DEFAULT_VIEWPORT },
      mode: 'chat',
      isInputVisible: true,
      selectedNodeId: null,
    });
  },
}));
