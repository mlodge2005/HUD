"use client";

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function headingToCardinal(deg: number): string {
  const i = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return CARDINALS[i];
}

type Props = {
  heading: number | null;
  stale?: boolean;
};

export default function CompassWidget({ heading, stale }: Props) {
  if (heading == null) {
    return (
      <div className="bg-black/60 text-white rounded-lg px-4 py-2 text-center text-sm">
        Data Unavailable
      </div>
    );
  }

  return (
    <div className="bg-black/60 text-white rounded-lg px-4 py-2 text-center">
      {stale && (
        <div className="text-xs text-amber-400 mb-0.5">Stale</div>
      )}
      <div className="text-2xl font-mono">{Math.round(heading)}°</div>
      <div className="text-sm">{headingToCardinal(heading)}</div>
    </div>
  );
}
