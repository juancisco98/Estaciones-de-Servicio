import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Station, AlertLevel } from '../types';
import { MAP_CENTER, MAP_ZOOM_DEFAULT, MAP_RESIZE_DELAY_MS } from '../constants';
import { useTheme } from '../context/ThemeContext';
import { useAlerts } from '../hooks/useAlerts';

// Fix Leaflet Default Icon — use local npm package assets (no CDN)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

interface MapBoardProps {
    stations: Station[];
    selectedStation: Station | null;
    onStationSelect: (station: Station) => void;
    flyToCenter?: [number, number];
}

/** Color-coded station icon based on alert level. Pulses on CRITICAL. */
const createStationIcon = (alertLevel: AlertLevel | null, isSelected: boolean) => {
    const colors: Record<string, { bg: string; border: string; shadow: string }> = {
        CRITICAL: { bg: '#ef4444', border: '#fca5a5', shadow: 'rgba(239,68,68,0.5)' },
        WARNING:  { bg: '#f97316', border: '#fdba74', shadow: 'rgba(249,115,22,0.4)' },
        INFO:     { bg: '#3b82f6', border: '#93c5fd', shadow: 'rgba(59,130,246,0.4)' },
        OK:       { bg: '#f59e0b', border: '#fcd34d', shadow: 'rgba(245,158,11,0.4)' },
    };
    const key = alertLevel ?? 'OK';
    const { bg, border, shadow } = colors[key] ?? colors.OK;
    const pulse = alertLevel === 'CRITICAL'
        ? `<span style="position:absolute;inset:0;border-radius:inherit;background:${bg};opacity:0.4;animation:ping 1s cubic-bezier(0,0,0.2,1) infinite;"></span>`
        : '';
    const ring = isSelected ? `box-shadow:0 0 0 3px white,0 0 0 5px ${bg};` : `box-shadow:0 4px 14px ${shadow};`;
    const html = `
        <div style="position:relative;width:40px;height:40px;">
            ${pulse}
            <div style="position:relative;background:${bg};border:2.5px solid ${border};${ring}width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;z-index:1;">
                ⛽
            </div>
        </div>
    `;
    return L.divIcon({ html, className: '', iconSize: [40, 40], iconAnchor: [20, 40] });
};

const FlyToLocation: React.FC<{ center?: [number, number] }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center) map.flyTo(center, 16, { animate: true, duration: 1.2 });
    }, [map, center]);
    return null;
};

const MapResizer: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => map.invalidateSize(), MAP_RESIZE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

const MapBoard: React.FC<MapBoardProps> = ({ stations, selectedStation, onStationSelect, flyToCenter }) => {
    const { theme } = useTheme();
    const { getStationAlertMap } = useAlerts();
    const alertMap = getStationAlertMap();

    const tileUrl = theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

    const activeStations = stations.filter(s => s.isActive);

    return (
        <>
            {/* Pulse animation for critical markers */}
            <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
            <MapContainer
                center={MAP_CENTER}
                zoom={MAP_ZOOM_DEFAULT}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
            >
                <TileLayer key={theme} attribution={tileAttribution} url={tileUrl} />
                <MapResizer />
                <FlyToLocation center={flyToCenter} />

                {activeStations.map(station => {
                    const alertLevel  = alertMap.get(station.id) ?? null;
                    const isSelected  = selectedStation?.id === station.id;
                    return (
                        <Marker
                            key={station.id}
                            position={station.coordinates}
                            icon={createStationIcon(alertLevel, isSelected)}
                            eventHandlers={{ click: () => onStationSelect(station) }}
                        >
                            <Popup>
                                <div style={{ padding: '4px 2px', minWidth: '150px' }}>
                                    <p style={{ fontWeight: 700, fontSize: '13px', margin: '0 0 2px', color: '#111' }}>{station.name}</p>
                                    <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px' }}>{station.address}</p>
                                    {alertLevel && (
                                        <p style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            margin: 0,
                                            color: alertLevel === 'CRITICAL' ? '#ef4444' : alertLevel === 'WARNING' ? '#f97316' : '#3b82f6',
                                        }}>
                                            ● {alertLevel}
                                        </p>
                                    )}
                                    {station.stationCode && (
                                        <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0' }}>{station.stationCode}</p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </>
    );
};

export default MapBoard;
