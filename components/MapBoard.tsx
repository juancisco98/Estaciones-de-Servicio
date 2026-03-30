import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Barbershop } from '../types';
import { MAP_CENTER, MAP_RESIZE_DELAY_MS } from '../constants';
import { useTheme } from '../context/ThemeContext';

// Fix Leaflet Default Icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DailySummary {
  cuts: number;
  revenue: number;
  activeBarbers: number;
}

interface MapBoardProps {
  barbershops: Barbershop[];
  selectedBarbershop: Barbershop | null;
  onBarbershopSelect: (shop: Barbershop) => void;
  getDailySummary: (barbershopId: string) => DailySummary;
  flyToCenter?: [number, number];
}

// Ícono para barberías
const createBarbershopIcon = (isActive: boolean) => {
  const bg = isActive
    ? 'background:#f59e0b;border-color:#fcd34d;box-shadow:0 4px 14px rgba(245,158,11,0.45)'
    : 'background:#9ca3af;border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
  const html = `
    <div style="${bg};width:38px;height:38px;border-radius:12px;border:2.5px solid;display:flex;align-items:center;justify-content:center;font-size:18px">
      ✂️
    </div>
  `;
  return L.divIcon({ html, className: '', iconSize: [38, 38], iconAnchor: [19, 38] });
};

// Fly to location when search result changes
const FlyToLocation: React.FC<{ center?: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { animate: true, duration: 1.2 });
    }
  }, [map, center]);
  return null;
};

// Invalidate map size on mount
const MapResizer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), MAP_RESIZE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const MapBoard: React.FC<MapBoardProps> = ({ barbershops, selectedBarbershop, onBarbershopSelect, getDailySummary, flyToCenter }) => {
  const { theme } = useTheme();
  const activeBarbershops = barbershops.filter(b => b.isActive);

  // Carto Voyager: mucho más limpio y moderno que OSM
  // Voyager en ambos modos: limpio, legible, sin el negro extremo
  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer key={theme} attribution={tileAttribution} url={tileUrl} />
      <MapResizer />
      <FlyToLocation center={flyToCenter} />

      {activeBarbershops.map(shop => {
        const summary = getDailySummary(shop.id);
        return (
          <Marker
            key={shop.id}
            position={shop.coordinates}
            icon={createBarbershopIcon(shop.isActive)}
            eventHandlers={{ click: () => onBarbershopSelect(shop) }}
          >
            <Popup>
              <div style={{ padding: '4px 2px', minWidth: '130px' }}>
                <p style={{ fontWeight: 700, fontSize: '13px', margin: '0 0 2px', color: '#111' }}>{shop.name}</p>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px' }}>{shop.neighborhood ?? shop.address}</p>
                {summary.cuts > 0 && (
                  <p style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, margin: 0 }}>
                    {summary.cuts} corte{summary.cuts !== 1 ? 's' : ''} hoy · ${summary.revenue.toLocaleString('es-AR')}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default MapBoard;
