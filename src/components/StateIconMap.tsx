import React, { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// GeoJSON público e otimizado com os estados brasileiros (possui a propriedade 'sigla')
const BRAZIL_GEO_URL = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

// Cache em memória para não repetir requisições de rede
let brazilDataPromise: Promise<any> | null = null;
let cachedBrazilData: any = null;

function fetchBrazilGeoData() {
  if (cachedBrazilData) return Promise.resolve(cachedBrazilData);
  if (!brazilDataPromise) {
    brazilDataPromise = fetch(BRAZIL_GEO_URL)
      .then(res => res.json())
      .then(data => {
        cachedBrazilData = data;
        return data;
      })
      .catch(err => {
        brazilDataPromise = null;
        throw err;
      });
  }
  return brazilDataPromise;
}

// Coordenadas centrais e escala calculadas para enquadrar perfeitamente a silhueta de cada estado
const STATE_COORDS: Record<string, { center: [number, number]; scale: number }> = {
  AC: { center: [-70.0, -9.2], scale: 550 },
  AL: { center: [-36.5, -9.7], scale: 1400 },
  AP: { center: [-51.5, 1.4], scale: 650 },
  AM: { center: [-64.5, -3.5], scale: 220 },
  BA: { center: [-41.8, -12.5], scale: 320 },
  CE: { center: [-39.5, -5.2], scale: 700 },
  DF: { center: [-47.9, -15.8], scale: 5000 },
  ES: { center: [-40.5, -19.6], scale: 950 },
  GO: { center: [-49.5, -15.8], scale: 450 },
  MA: { center: [-45.2, -5.2], scale: 420 },
  MT: { center: [-56.0, -12.6], scale: 320 },
  MS: { center: [-54.5, -20.2], scale: 500 },
  MG: { center: [-44.5, -18.5], scale: 380 },
  PA: { center: [-52.5, -3.8], scale: 260 },
  PB: { center: [-36.8, -7.1], scale: 1200 },
  PR: { center: [-51.5, -24.8], scale: 650 },
  PE: { center: [-38.0, -8.3], scale: 800 },
  PI: { center: [-42.8, -7.4], scale: 450 },
  RJ: { center: [-42.5, -22.2], scale: 900 },
  RN: { center: [-36.5, -5.8], scale: 1300 },
  RS: { center: [-53.5, -30.0], scale: 500 },
  RO: { center: [-63.2, -11.2], scale: 550 },
  RR: { center: [-61.3, 2.0], scale: 550 },
  SC: { center: [-50.5, -27.2], scale: 750 },
  SP: { center: [-49.0, -22.2], scale: 550 },
  SE: { center: [-37.4, -10.6], scale: 1800 },
  TO: { center: [-48.3, -10.2], scale: 420 }
};

const STATE_NAMES: Record<string, string> = {
  ac: 'AC', acre: 'AC', al: 'AL', alagoas: 'AL', ap: 'AP', amapa: 'AP', am: 'AM', amazonas: 'AM',
  ba: 'BA', bahia: 'BA', ce: 'CE', ceara: 'CE', df: 'DF', 'distrito federal': 'DF', brasilia: 'DF',
  es: 'ES', 'espirito santo': 'ES', go: 'GO', goias: 'GO', ma: 'MA', maranhao: 'MA',
  mt: 'MT', 'mato grosso': 'MT', ms: 'MS', 'mato grosso do sul': 'MS', mg: 'MG', 'minas gerais': 'MG',
  pa: 'PA', para: 'PA', pb: 'PB', paraiba: 'PB', pr: 'PR', parana: 'PR', pe: 'PE', pernambuco: 'PE',
  pi: 'PI', piaui: 'PI', rj: 'RJ', 'rio de janeiro': 'RJ', rn: 'RN', 'rio grande do norte': 'RN',
  rs: 'RS', 'rio grande do sul': 'RS', ro: 'RO', rondonia: 'RO', rr: 'RR', roraima: 'RR',
  sc: 'SC', 'santa catarina': 'SC', sp: 'SP', 'sao paulo': 'SP', se: 'SE', sergipe: 'SE',
  to: 'TO', tocantins: 'TO'
};

export interface StateIconMapProps {
  state: string;               // Aceita sigla ("MG", "SP") ou nome ("Minas Gerais", "Goiás", etc.)
  color?: string;               // Cor do estado (padrão: "#3b82f6")
  className?: string;           // Classes adicionais para o container (ex: "w-10 h-10")
  zoom?: number;                // Fator de aproximação/zoom do mapa (padrão: 1.35)
}

export function StateIconMap({
  state,
  color = "#3b82f6",
  className = "w-10 h-10",
  zoom = 1.35
}: StateIconMapProps) {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Normaliza o nome/sigla recebido
  const normalized = (state || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const stateCode = STATE_NAMES[normalized] || normalized.toUpperCase();
  const coords = STATE_COORDS[stateCode] || { center: [-55, -15], scale: 150 };

  useEffect(() => {
    fetchBrazilGeoData()
      .then(data => {
        setGeoData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`${className} rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse flex items-center justify-center`} />
    );
  }

  if (!geoData) {
    return (
      <div className={`${className} rounded-lg bg-slate-100 flex items-center justify-center font-mono font-bold text-xs text-slate-500`}>
        {stateCode}
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center justify-center overflow-hidden`}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: coords.scale * zoom, center: coords.center }}
        width={100}
        height={100}
        className="w-full h-full select-none pointer-events-none"
      >
        <Geographies geography={geoData}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const isTargetState = geo.properties.sigla === stateCode;

              // Renderiza apenas o estado alvo destacado (ou os vizinhos apagados como contexto se quiser)
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    fill: isTargetState ? color : "currentColor",
                    fillOpacity: isTargetState ? 1.0 : 0.06,
                    stroke: isTargetState ? color : "currentColor",
                    strokeWidth: isTargetState ? 0.7 : 0.2,
                    strokeOpacity: isTargetState ? 0.4 : 0.05,
                    outline: "none"
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}

export default StateIconMap;
