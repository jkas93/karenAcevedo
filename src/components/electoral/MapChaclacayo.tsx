'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import { LocalVotacion, Mesa } from '@/lib/firebase/electoral-service';
import { CHACLACAYO_ELECTORAL_LOCATIONS, googleMapsUrl } from '@/lib/electoral/locations';
import { Layers, MapPin, School, Navigation } from 'lucide-react';

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
    if (positions.length > 1) map.fitBounds(positions, { padding: [40, 40], maxZoom: 15 });
  }, [locales, map]);

  return null;
}

export default function MapChaclacayo({ locales, mesas }: MapChaclacayoProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null);
  const [mapType, setMapType] = useState<'streets' | 'hybrid'>('streets');

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 20);
    fetch('/data/zonas-chaclacayo.json')
      .then((res) => res.json())
      .then((data: unknown) => setGeoData(data as GeoJsonObject))
      .catch((err) => console.warn('GeoJSON zonas:', err));
    return () => clearTimeout(timer);
  }, []);

  // Lista de locales: usa los de Firestore y si aún no cargaron, usa los 8 colegios oficiales de Chaclacayo
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

  const centerCoordinates: [number, number] = [-11.9818, -76.772];

  // URL de capas de Google Maps oficial (roadmap vs híbrido/satélite)
  const tileUrl =
    mapType === 'streets'
      ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
      : 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm z-0 lg:h-[480px]">
      {/* Selector de capa Google Maps */}
      <div className="absolute top-3 right-3 z-[400] flex items-center rounded-xl bg-white/95 p-1 shadow-md backdrop-blur-xs border border-slate-200">
        <button
          type="button"
          onClick={() => setMapType('streets')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
            mapType === 'streets'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Google Calles
        </button>
        <button
          type="button"
          onClick={() => setMapType('hybrid')}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
            mapType === 'hybrid'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Satélite
        </button>
      </div>

      <MapContainer
        center={centerCoordinates}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <FitLocalBounds locales={displayLocales} />

        {/* Capa de Google Maps */}
        <TileLayer
          key={mapType}
          attribution='&copy; Google Maps'
          url={tileUrl}
          maxZoom={20}
          subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
        />

        {/* Zonas electorales poligonales de Chaclacayo */}
        {geoData && (
          <GeoJSON
            data={geoData}
            style={(feature) => ({
              color: feature?.properties?.color || '#2563eb',
              weight: 2,
              fillColor: feature?.properties?.color || '#3b82f6',
              fillOpacity: 0.12,
              dashArray: '4, 6',
            })}
            onEachFeature={(feature, layer) => {
              if (feature.properties?.nombre) {
                layer.bindPopup(`
                  <div style="text-align: center; padding: 4px;">
                    <span style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; display: block;">Sector Electoral</span>
                    <strong style="font-size: 13px; color: #0f172a;">${feature.properties.nombre}</strong>
                  </div>
                `);
              }
            }}
          />
        )}

        {/* Marcadores de los 8 Colegios Electorales */}
        {displayLocales.map((local) => {
          const mesasDelLocal = mesas.filter((m) => m.local_id === local.id);
          const totalMesasLocal = local.total_mesas || mesasDelLocal.length || 1;
          const mesasEnviadas = mesasDelLocal.filter((m) => m.estado === 'enviada').length;
          const porcentaje = totalMesasLocal > 0
            ? Math.round((mesasEnviadas / totalMesasLocal) * 100)
            : 0;

          // Color del marcador
          let markerBg = '#2563eb'; // Azul neutro al inicio
          if (porcentaje === 100) markerBg = '#10b981'; // Verde
          else if (porcentaje > 0) markerBg = '#f97316'; // Naranja

          // Nombre corto para la etiqueta visible
          const cleanName = local.nombre
            .replace(/^I\.E\.\s*(\d+\s*)?/i, '')
            .replace(/^Colegio\s*/i, '')
            .trim();

          const customLabelIcon = L.divIcon({
            className: 'custom-school-pin',
            html: `
              <div style="
                display: inline-flex;
                align-items: center;
                gap: 5px;
                background: white;
                color: #0f172a;
                font-family: inherit;
                font-size: 11px;
                font-weight: 800;
                padding: 4px 8px;
                border-radius: 9999px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.22);
                border: 2px solid ${markerBg};
                white-space: nowrap;
                cursor: pointer;
                transform: translate(-50%, -50%);
              ">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${markerBg};"></span>
                <span>${cleanName}</span>
                <span style="background: #f1f5f9; color: #475569; font-size: 9px; padding: 1px 4px; border-radius: 4px;">${totalMesasLocal}m</span>
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

          return (
            <Marker
              key={local.id}
              position={[local.latitud, local.longitud]}
              icon={customLabelIcon}
            >
              <Popup>
                <div className="p-1 min-w-[220px]">
                  <div className="flex items-start gap-1.5 mb-1">
                    <span className="text-blue-600 font-bold text-xs uppercase tracking-wider block">
                      Local de Votación
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
