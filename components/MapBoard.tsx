import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Station, AlertLevel } from '../types';
import { MAP_CENTER, MAP_ZOOM_DEFAULT, MAP_RESIZE_DELAY_MS } from '../constants';
import { useAlerts } from '../hooks/useAlerts';

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

const ICON_SIZE = 36;
const ICON_HALF = ICON_SIZE / 2;
const EMOJI_SIZE = 18;

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
    const ring = isSelected ? `box-shadow:0 0 0 2px white,0 0 0 4px ${bg};` : `box-shadow:0 3px 10px ${shadow};`;
    const html = `
        <div style="position:relative;width:${ICON_SIZE}px;height:${ICON_SIZE}px;">
            ${pulse}
            <div style="position:relative;background:${bg};border:2px solid ${border};${ring}width:${ICON_SIZE}px;height:${ICON_SIZE}px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:${EMOJI_SIZE}px;z-index:1;">
                ⛽
            </div>
        </div>
    `;
    return L.divIcon({ html, className: '', iconSize: [ICON_SIZE, ICON_SIZE], iconAnchor: [ICON_HALF, ICON_SIZE] });
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

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const MapBoard: React.FC<MapBoardProps> = ({ stations, selectedStation, onStationSelect, flyToCenter }) => {
    const { getStationAlertMap } = useAlerts();
    const alertMap = getStationAlertMap();

    const activeStations = stations.filter(s => s.isActive);

    return (
        <>
            <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
            <MapContainer
                center={MAP_CENTER}
                zoom={MAP_ZOOM_DEFAULT}
                style={{ height: '100%', width: '100%' }}
                className="z-0 map-always-light"
            >
                <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
                <MapResizer />
                <FlyToLocation center={flyToCenter} />

                {activeStations.length === 0 && (
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        zIndex: 1000, textAlign: 'center', padding: '24px 32px',
                        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
                        borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#374151', margin: '0 0 4px' }}>Sin estaciones activas</p>
                        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Agregá estaciones desde Ajustes para verlas en el mapa.</p>
                    </div>
                )}

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
                                <div style={{ padding: '8px 4px', minWidth: '160px' }}>
                                    <p style={{ fontWeight: 700, fontSize: '15px', margin: '0 0 4px', color: '#111' }}>{station.name}</p>
                                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 6px' }}>{station.address}</p>
                                    {alertLevel && (
                                        <p style={{
                                            fontSize: '13px',
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
