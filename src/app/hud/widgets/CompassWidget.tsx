"use client";

type Props = {
  /** Streamer heading in degrees (0–359) from telemetry. */
  heading: number | null;
};

export default function CompassWidget({ heading }: Props) {
  if (heading == null) {
    return (
      <div className="bg-black/60 text-white rounded-lg px-4 py-3 text-center">
        <div className="text-sm text-gray-300">Heading</div>
        <div className="text-xl font-mono text-gray-400 mt-0.5">N/A</div>
      </div>
    );
  }

  const rotation = heading; // 0 = North, clockwise

  return (
    <div className="bg-black/60 text-white rounded-lg p-3 flex flex-col items-center">
      <div className="text-xs text-gray-300 mb-1">Heading</div>
      <div className="relative w-20 h-20 rounded-full border-2 border-white/60 flex items-center justify-center bg-black/40">
        {/* Cardinal labels on the ring */}
        <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/90">N</span>
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white/70">S</span>
        <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/70">W</span>
        <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/70">E</span>
        {/* Needle: points up (0°) when heading is 0 (North); rotate by heading so needle points to streamer direction */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="w-1 h-8 bg-red-500 rounded-full shadow-md origin-center -translate-y-3" />
        </div>
      </div>
      <div className="text-sm font-mono mt-1 text-white/90">{Math.round(heading)}°</div>
    </div>
  );
}
