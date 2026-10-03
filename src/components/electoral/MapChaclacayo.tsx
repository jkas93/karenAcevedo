'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import { LocalVotacion, Mesa } from '@/lib/firebase/electoral-service';
import { CHACLACAYO_ELECTORAL_LOCATIONS, googleMapsUrl } from '@/lib/electoral/locations';
import { Navigation, School } from 'lucide-react';

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
    if (positions.length > 0) {
      // Ajusta la vista para mostrar los 8 colegios desde Huascata hasta Santa Inés
      map.fitBounds(positions, { padding: [35, 35], maxZoom: 14 });
    }
  }, [locales, map]);

  return null;
}

export default function MapChaclacayo({ locales, mesas }: MapChaclacayoProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [mapType, setMapType] = useState<'google' | 'satellite' | 'carto'>('google');

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 20);
    fetch('/data/zonas-chaclacayo.json')
      .then((res) => res.json())
      .then((data: unknown) => setGeoData(data as GeoJsonObject))
      .catch((err) => console.warn('GeoJSON zonas:', err));
    return () => clearTimeout(timer);
  }, []);

  // Lista de locales: Firestore o los 8 colegios oficiales de Chaclacayo
  const displayLocales = useMemo(() => {
    if (locales.length > 0) return locales;
    return CHACLACAYO_ELECTORAL_LOCATIONS.map((seed) => ({
      id: `local_${seed.code.toLowerCase()}`,
      nombre: seed.nombre,
      direccion: [seed.direccion, seed.referencia].filter(Boolean).join(' · '),
      latitud: seed.latitud,
      longitud: seed.longitud,
      zona_id: seed.zona,
      total_mesas: seed.mesas,
    }));
  }, [locales]);

  if (!isMounted) {
    return (
      <div className="flex h-[360px] w-full animate-pulse items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-400 lg:h-[480px]">
        Cargando mapa electoral de Chaclacayo...
      </div>
    );
  }

  const centerCoordinates: [number, number] = [-11.9835, -76.782];

  // Configuración de capas
  const tileConfig = {
    google: {
      url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps',
    },
    satellite: {
      url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps Satélite',
    },
    carto: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      subdomains: ['a', 'b', 'c', 'd'],
      attribution: '&copy; OpenStreetMap, &copy; CARTO',
    },
  }[mapType];

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm z-0 lg:h-[480px]">
      {/* Selector de capa de mapa */}
      <div className="absolute top-3 right-3 z-[400] flex items-center rounded-xl bg-white/95 p-1 shadow-md backdrop-blur-xs border border-slate-200 text-xs">
        <button
          type="button"
          onClick={() => setMapType('google')}
          className={`rounded-lg px-2.5 py-1 font-bold transition ${
            mapType === 'google'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Google Calles
        </button>
        <button
          type="button"
          onClick={() => setMapType('satellite')}
          className={`rounded-lg px-2.5 py-1 font-bold transition ${
            mapType === 'satellite'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Satélite
        </button>
        <button
          type="button"
          onClick={() => setMapType('carto')}
          className={`rounded-lg px-2.5 py-1 font-bold transition ${
            mapType === 'carto'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Claro
        </button>
      </div>

      <MapContainer
        center={centerCoordinates}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <FitLocalBounds locales={displayLocales} />

        <TileLayer
          key={mapType}
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          maxZoom={20}
          subdomains={tileConfig.subdomains}
        />

        {/* Zonas electorales poligonales de Chaclacayo */}
        {geoData && (
          <GeoJSON
            data={geoData}
            style={(feature) => ({
              color: feature?.properties?.color || '#2563eb',
              weight: 2,
              fillColor: feature?.properties?.color || '#3b82f6',
              fillOpacity: 0.1,
              dashArray: '4, 6',
            })}
          />
        )}

        {/* Marcadores de los 8 Colegios Electorales */}
        {displayLocales.map((local, index) => {
          const mesasDelLocal = mesas.filter((m) => m.local_id === local.id);
          const totalMesasLocal = local.total_mesas || mesasDelLocal.length || 1;
          const mesasEnviadas = mesasDelLocal.filter((m) => m.estado === 'enviada').length;
          const porcentaje = totalMesasLocal > 0
            ? Math.round((mesasEnviadas / totalMesasLocal) * 100)
            : 0;

          // Color del pin
          let pinColor = '#2563eb'; // Azul estándar
          if (porcentaje === 100) pinColor = '#10b981'; // Verde completo
          else if (porcentaje > 0) pinColor = '#f97316'; // Naranja en proceso

          const shortName = local.nombre
            .replace(/^I\.E\.\s*(\d+\s*)?/i, '')
            .replace(/^Colegio\s*/i, '')
            .trim();

          // Pin circular con número y sombra elegante
          const pinIcon = L.divIcon({
            className: 'school-pin-marker',
            html: `
              <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
                transform: translate(-50%, -100%);
              ">
                <div style="
                  background: white;
                  color: #0f172a;
                  border: 2px solid ${pinColor};
                  padding: 2px 7px;
                  border-radius: 9999px;
                  font-size: 11px;
                  font-weight: 800;
                  white-space: nowrap;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.22);
                  display: flex;
                  align-items: center;
                  gap: 4px;
                  margin-bottom: 2px;
                ">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: ${pinColor};"></span>
                  <span>${shortName}</span>
                </div>
                <div style="
                  width: 28px;
                  height: 28px;
                  background: ${pinColor};
                  color: white;
                  border-radius: 50% 50% 50% 0;
                  transform: rotate(-45deg);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                  border: 2px solid white;
                ">
                  <span style="
                    transform: rotate(45deg);
                    font-size: 11px;
                    font-weight: 900;
                  ">${index + 1}</span>
                </div>
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          return (
            <Marker
              key={local.id}
              position={[local.latitud, local.longitud]}
              icon={pinIcon}
            >
              <Tooltip direction="top" offset={[0, -32]} opacity={0.95}>
                <span className="font-bold text-xs">{local.nombre}</span> ({totalMesasLocal} mesas)
              </Tooltip>
              <Popup>
                <div className="p-1 min-w-[220px]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-blue-600 font-bold text-[10px] uppercase tracking-wider block">
                      Colegio #{index + 1} · Chaclacayo
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 leading-tight mb-1">
                    {local.nombre}
                  </h3>
                  <p className="text-xs text-slate-600 mb-2 leading-snug">
                    {local.direccion}
                  </p>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-500">Avance de Actas:</span>
                      <span className="font-bold text-slate-800">{porcentaje}%</span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${porcentaje}%`,
                          backgroundColor: porcentaje === 100 ? '#10b981' : '#2563eb',
                        }}
                      />
                    </div>

                    <div className="text-slate-600 text-[11px] pt-1 flex justify-between border-t border-slate-100">
                      <span>Mesas Reportadas:</span>
                      <span className="font-bold text-slate-700">
                        {mesasEnviadas} de {totalMesasLocal}
                      </span>
                    </div>
                  </div>

                  <a
                    href={googleMapsUrl(local.nombre, local.direccion, local.latitud, local.longitud)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-center text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 no-underline"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    <span>Ver en Google Maps ↗</span>
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
