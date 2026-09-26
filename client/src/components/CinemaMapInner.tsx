import { MapPin } from "lucide-react";
import { VenueMap, MapMarker } from "@/components/ui/venue-map";

import type { MappedVenue } from "@/components/CinemaMap";

/**
 * Where the four cinemas are. Clicking a pin filters the listing below to that building,
 * which is the only reason to put a map on a listings page at all — a map you cannot act on
 * is a picture.
 */
function CinemaMap({
  venues,
  selectedId,
  onSelect,
}: {
  venues: MappedVenue[];
  selectedId?: string | null;
  onSelect?: (venueId: string | null) => void;
}) {
  const placed = venues.filter((v) => v.latitude !== 0 || v.longitude !== 0);
  if (placed.length === 0) return null;

  // Centre on the venues themselves rather than a hardcoded city point, so adding a cinema
  // in another district does not leave it off the edge of the map.
  const centre: [number, number] = [
    placed.reduce((sum, v) => sum + v.longitude, 0) / placed.length,
    placed.reduce((sum, v) => sum + v.latitude, 0) / placed.length,
  ];

  return (
    <div className="mb-6 h-72 overflow-hidden rounded-xl border border-line sm:h-96">
      <VenueMap center={centre} zoom={11.2}>
        {placed.map((venue) => {
          const active = venue.id === selectedId;
          return (
            <MapMarker
              key={venue.id}
              longitude={venue.longitude}
              latitude={venue.latitude}
              onClick={() => onSelect?.(active ? null : venue.id)}
            >
              <div className="group flex -translate-y-1/2 cursor-pointer flex-col items-center">
                <MapPin
                  size={active ? 32 : 26}
                  aria-hidden
                  className="drop-shadow-lg transition-all"
                  style={{ color: "#FF3B30", fill: active ? "#FF3B30" : "#7a1410" }}
                />
                <span
                  className={
                    "mt-0.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium shadow " +
                    (active ? "bg-accent text-surface" : "bg-surface/90 text-ink")
                  }
                >
                  {venue.name}
                </span>
              </div>
            </MapMarker>
          );
        })}
      </VenueMap>
    </div>
  );
}

export default CinemaMap;
