"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type MapsDiagnosticsState = {
  keySet: boolean;
  keyLength: number;
  googleMapsLoaded: boolean;
  scriptError: string | null;
  authFailureAt: number | null;
};

const initialState: MapsDiagnosticsState = {
  keySet: false,
  keyLength: 0,
  googleMapsLoaded: false,
  scriptError: null,
  authFailureAt: null,
};

type SetMapsDiagnostics = (update: Partial<MapsDiagnosticsState>) => void;

const MapsDiagnosticsContext = createContext<{
  state: MapsDiagnosticsState;
  setDiagnostics: SetMapsDiagnostics;
} | null>(null);

export function MapsDiagnosticsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MapsDiagnosticsState>(initialState);
  const setDiagnostics = useCallback((update: Partial<MapsDiagnosticsState>) => {
    setState((prev) => ({ ...prev, ...update }));
  }, []);
  return (
    <MapsDiagnosticsContext.Provider value={{ state, setDiagnostics }}>
      {children}
    </MapsDiagnosticsContext.Provider>
  );
}

export function useMapsDiagnostics() {
  const ctx = useContext(MapsDiagnosticsContext);
  return ctx ?? { state: initialState, setDiagnostics: () => {} };
}
