import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  LngLatLike,
  Map as MaplibreMap,
  GeoJSONSource,
  LayerSpecification,
} from "maplibre-gl";

export type MapLayerStyle = Omit<LayerSpecification, "id" | "source">;

export interface GeoJsonLayerConfig {
  id: string;
  data: GeoJSON.GeoJSON | string;
  style?: MapLayerStyle;
}

interface MapProps {
  center?: LngLatLike;
  zoom?: number;
  layers?: GeoJsonLayerConfig[];
  defaultLayerStyle?: MapLayerStyle;
}

const FALLBACK_DEFAULT_STYLE: MapLayerStyle = {
  type: "fill",
  paint: {
    "fill-color": "#0080ff",
    "fill-opacity": 0.5,
  },
};

export default function Map({
  center = [2.3513, 48.8575],
  zoom = 12,
  layers = [],
  defaultLayerStyle = FALLBACK_DEFAULT_STYLE,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MaplibreMap | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const activeLayerIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "http://tileserver:8080/styles/basic-preview/style.json",
      center: center,
      zoom: zoom,
    });

    map.current.on("load", () => {
      setIsMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;
    const m = map.current;

    const currentLayerIds = new Set(layers.map((l) => l.id));

    activeLayerIds.current.forEach((id) => {
      if (!currentLayerIds.has(id)) {
        if (m.getLayer(id)) m.removeLayer(id);
        if (m.getSource(id)) m.removeSource(id);
      }
    });
    // 2. Add new layers or update existing ones
    layers.forEach((layer) => {
      const layerStyle = layer.style || defaultLayerStyle;

      const layerSpec: LayerSpecification = {
        id: layer.id,
        source: layer.id,
        ...(layerStyle as any),
      };

      if (m.getSource(layer.id)) {
        // LAYER EXISTS: Reactively update the data
        const source = m.getSource(layer.id) as GeoJSONSource;
        source.setData(layer.data);

        // Note: For high-performance apps, reactive styling (paint properties)
        // should be done via m.setPaintProperty(). For simplicity here, we assume
        // data changes are the primary reactive update.
      } else {
        // NEW LAYER: Add source, then add layer
        m.addSource(layer.id, {
          type: "geojson",
          data: layer.data,
        });
        m.addLayer(layerSpec);
      }
    });

    // Update our ref to match the currently rendered layers
    activeLayerIds.current = currentLayerIds;
  }, [layers, isMapLoaded, defaultLayerStyle]);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="absolute w-full h-full"></div>
    </div>
  );
}
