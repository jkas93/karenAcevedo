'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import { LocalVotacion, Mesa } from '@/lib/firebase/electoral-service';
import { googleMapsUrl } from '@/lib/electoral/locations';

// Corregir los iconos por defecto de Leaflet en Next.js
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

interface MapChaclacayoProps {
  locales: LocalVotacion[];
  mesas: Mesa[];
}

function FitLocalBounds({ locales }: { locales: LocalVotacion[] }) {
  const map = useMap();

  useEffect(() => {
    const positions = locales
      .filter((local) => Number.isFinite(local.latitud) && Number.isFinite(local.longitud))
      .map((local) => [local.latitud, local.longitud] as [number, number]);
    if (positions.length === 1) map.setView(positions[0], 15);
    if (positions.length > 1) map.fitBounds(positions, { padding: [32, 32], maxZoom: 15 });
  }, [locales, map]);

  return null;
}

export default function MapChaclacayo({ locales, mesas }: MapChaclacayoProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 10);
    // Cargar la data oficial en formato GeoJSON
    fetch('/data/zonas-chaclacayo.json')
      .then(res => res.json())
      .then((data: unknown) => setGeoData(data as GeoJsonObject))
      .catch(err => console.error('Error cargando GeoJSON:', err));
    return () => clearTimeout(timer);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[360px] w-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center text-slate-400 lg:h-[500px]">
        Cargando mapa...
      </div>
    );
  }

  const centerCoordinates: [number, number] = [-11.9818, -76.7651];

  return (
    <div className="h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm z-0 lg:h-[500px]">
      <MapContainer
        center={centerCoordinates}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <FitLocalBounds locales={locales} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Renderizar los sectores electorales desde GeoJSON */}
        {geoData && (
          <GeoJSON
            data={geoData}
            style={(feature) => ({
              color: feature?.properties?.color || '#3b82f6',
              weight: 2.5,
              fillColor: feature?.properties?.color || '#3b82f6',
              fillOpacity: 0.15,
              dashArray: '4, 6'
            })}
            onEachFeature={(feature, layer) => {
              if (feature.properties && feature.properties.nombre) {
                layer.bindPopup(`
                  <div class="text-center p-1">
                    <span class="font-black text-xs uppercase tracking-wider text-slate-700 block mb-1">Zona Electoral</span>
                    <span class="font-bold text-sm text-slate-900">${feature.properties.nombre}</span>
                  </div>
                `);
              }
            }}
          />
        )}

        {/* Locales de Votación */}
        {locales.map((local) => {
          const mesasDelLocal = mesas.filter((m) => m.local_id === local.id);
          const mesasEnviadas = mesasDelLocal.filter((m) => m.estado === 'enviada').length;
          const porcentaje = mesasDelLocal.length > 0
            ? Math.round((mesasEnviadas / mesasDelLocal.length) * 100)
            : 0;

          let markerColor = '#ef4444'; // Rojo (0%)
          if (porcentaje === 100) markerColor = '#10b981'; // Verde (100%)
          else if (porcentaje > 0) markerColor = '#f97316'; // Naranja (1-99%)

          const customIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              background-color: ${markerColor};
              width: 24px;
              height: 24px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            "></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          return (
            <Marker key={local.id} position={[local.latitud, local.longitud]} icon={customIcon}>
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-sm text-slate-900 mb-1">{local.nombre}</h3>
                  <p className="text-xs text-slate-500 mb-2">{local.direccion}</p>
                  
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-500">Reportadas:</span>
                      <span className="font-bold text-slate-800">{porcentaje}%</span>
                    </div>
                    
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${porcentaje}%`,
                          backgroundColor: porcentaje === 100 ? '#10b981' : '#3b82f6'
                        }}
                      />
                    </div>
                    
                    <div className="text-slate-600 text-[11px] pt-1 flex justify-between border-t border-slate-100">
                      <span>Mesas Enviadas:</span>
                      <span className="font-semibold text-slate-700">{mesasEnviadas} de {local.total_mesas}</span>
                    </div>
                  </div>
                  <a
                    href={googleMapsUrl(local.nombre, local.direccion, local.latitud, local.longitud)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-bold text-white no-underline"
                  >
                    Abrir en Google Maps ↗
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
