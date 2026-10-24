import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type UiState = {
  /** User preference (persisted). Composer routes may force narrow sidebar regardless. */
  sidebarCollapsed: boolean;
};

const SIDEBAR_KEY = 'billing.sidebarCollapsed';

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(v: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

const initialState: UiState = {
  sidebarCollapsed: readSidebarCollapsed(),
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      persistSidebarCollapsed(state.sidebarCollapsed);
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
      persistSidebarCollapsed(state.sidebarCollapsed);
    },
  },
});

export const { toggleSidebar, setSidebarCollapsed } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
