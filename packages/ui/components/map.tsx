import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LngLatLike, Map as MaplibreMap } from "maplibre-gl";

interface MapProps {
  center?: LngLatLike;
  zoom?: number;
}

export default function Map({
  center = [2.3513, 48.8575],
  zoom = 12,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MaplibreMap | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://tileserver:8080/styles/basic-preview/style.json",
      center: center,
      zoom: zoom,
    });
  }, [center, zoom]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute w-full h-full"></div>
    </div>
  );
}
