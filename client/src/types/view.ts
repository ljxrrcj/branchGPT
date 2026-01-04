export type ViewMode = 'chat' | 'branch' | 'overview';
export type ZoomPhase = 'snap' | 'free';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
  zoomPhase: ZoomPhase;
}

export interface ViewState {
  mode: ViewMode;
  viewport: Viewport;
  isInputVisible: boolean;
  focusRatio: number;
  selectedNodeId: string | null;
}
