import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const robotIcon = L.divIcon({
  html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#06B6D4,#EC4899);border-radius:50%;border:3px solid #fff;box-shadow:0 0 15px #06B6D4;display:flex;align-items:center;justify-content:center;font-size:14px;">🤖</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const startIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;background:#06B6D4;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px #06B6D4;"></div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const endIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;background:#EC4899;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px #EC4899;"></div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface MapViewProps {
  startPos: [number, number] | null;
  endPos: [number, number] | null;
  obstacles: { lat: number; lng: number; radius: number }[];
  paths: { path: [number, number][]; color: string; best: boolean }[];
  robotPos: [number, number] | null;
  mode: "start" | "end" | "obstacle";
  onMapClick: (lat: number, lng: number) => void;
  userLocation: [number, number] | null;
}

export default function MapView({ startPos, endPos, obstacles, paths, robotPos, onMapClick, userLocation }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const robotMarkerRef = useRef<L.Marker | null>(null);
  const obstacleLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const pathLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = userLocation || [28.6139, 77.2090];
    const map = L.map(containerRef.current, { zoomControl: true }).setView(center, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    obstacleLayerRef.current.addTo(map);
    pathLayerRef.current.addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to user location
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo(userLocation, 14, { duration: 1.5 });
    }
  }, [userLocation]);

  // Start marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (startMarkerRef.current) { map.removeLayer(startMarkerRef.current); startMarkerRef.current = null; }
    if (startPos) {
      startMarkerRef.current = L.marker(startPos, { icon: startIcon }).addTo(map);
    }
  }, [startPos]);

  // End marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (endMarkerRef.current) { map.removeLayer(endMarkerRef.current); endMarkerRef.current = null; }
    if (endPos) {
      endMarkerRef.current = L.marker(endPos, { icon: endIcon }).addTo(map);
    }
  }, [endPos]);

  // Robot marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (robotMarkerRef.current) {
      if (robotPos) {
        robotMarkerRef.current.setLatLng(robotPos);
      } else {
        map.removeLayer(robotMarkerRef.current);
        robotMarkerRef.current = null;
      }
    } else if (robotPos) {
      robotMarkerRef.current = L.marker(robotPos, { icon: robotIcon }).addTo(map);
    }
  }, [robotPos]);

  // Obstacles
  useEffect(() => {
    const layer = obstacleLayerRef.current;
    layer.clearLayers();
    obstacles.forEach((obs) => {
      L.circle([obs.lat, obs.lng], {
        radius: obs.radius * 111000,
        color: "#EC4899",
        fillColor: "#EC4899",
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(layer);
    });
  }, [obstacles]);

  // Paths
  useEffect(() => {
    const layer = pathLayerRef.current;
    layer.clearLayers();
    paths.forEach((p) => {
      L.polyline(p.path, {
        color: p.color,
        weight: p.best ? 5 : 2,
        opacity: p.best ? 1 : 0.4,
        dashArray: p.best ? undefined : "8 4",
      }).addTo(layer);
    });
  }, [paths]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" />;
}
