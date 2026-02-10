"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; errorMessage: string | null };

/**
 * Catches React/LiveKit errors so the HUD page does not white-screen.
 * Shows a banner and keeps the layout usable (buttons disabled, no video).
 */
export default class HUDErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      console.error("[HUDErrorBoundary]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
          <div className="bg-red-900/80 text-white px-6 py-4 rounded-lg max-w-lg text-center space-y-2">
            <p className="font-semibold">LiveKit failed to initialize</p>
            <p className="text-sm text-red-200">
              {this.state.errorMessage ?? "An unexpected error occurred."}
            </p>
            <p className="text-xs text-red-300 mt-2">
              The page is in a safe state. Refresh to try again, or check the console for details.
            </p>
          </div>
          <a
            href="/hud"
            className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm"
          >
            Refresh HUD
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
