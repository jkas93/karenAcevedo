'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LocalVotacion, Mesa } from '@/lib/firebase/electoral-service';

// Corregir el icono de Leaflet en Next.js
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

// Polígono aproximado de Chaclacayo (Para demo, idealmente se extrae de un GeoJSON real)
const chaclacayoPolygon: [number, number][] = [
  [-11.970, -76.775],
  [-11.975, -76.755],
  [-11.985, -76.745],
  [-11.995, -76.765],
  [-11.980, -76.785],
];

interface MapChaclacayoProps {
  locales: LocalVotacion[];
  mesas: Mesa[];
}

export default function MapChaclacayo({ locales, mesas }: MapChaclacayoProps) {
  // Evitar error "window is not defined" en SSR
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">Cargando mapa...</div>;

  const centerCoordinates: [number, number] = [-11.9818, -76.7651]; // Coordenadas de Chaclacayo

  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden border border-slate-200 shadow-sm z-0">
      <MapContainer
        center={centerCoordinates}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Zona de Chaclacayo (Opcional visual) */}
        <Polygon pathOptions={{ color: '#16a34a', weight: 2, fillOpacity: 0.1 }} positions={chaclacayoPolygon} />

        {/* Locales de Votación */}
        {locales.map((local) => {
          // Calcular el progreso de las actas de este local
          const mesasDelLocal = mesas.filter(m => m.local_id === local.id);
          const mesasEnviadas = mesasDelLocal.filter(m => m.estado === 'enviada').length;
          const porcentaje = mesasDelLocal.length > 0 ? Math.round((mesasEnviadas / mesasDelLocal.length) * 100) : 0;

          // Elegir color según progreso
          let markerColor = 'red';
          if (porcentaje === 100) markerColor = 'green';
          else if (porcentaje > 0) markerColor = 'orange';

          // Crear icono personalizado (HTML)
          const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${markerColor}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          return (
            <Marker key={local.id} position={[local.latitud, local.longitud]} icon={customIcon}>
              <Popup>
                <div className="p-1">
                  <h3 className="font-bold text-sm mb-1">{local.nombre}</h3>
                  <p className="text-xs text-slate-500 mb-2">{local.direccion}</p>
                  
                  <div className="bg-slate-50 p-2 rounded border text-xs">
                    <div className="flex justify-between mb-1">
                      <span>Progreso:</span>
                      <span className="font-bold">{porcentaje}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                      <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${porcentaje}%` }}></div>
                    </div>
                    <div>
                      Mesas enviadas: <b>{mesasEnviadas}</b> de <b>{local.total_mesas}</b>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
