import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Activity, ShieldAlert, Target, Crosshair } from 'lucide-react'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import { authFetch } from '../../auth/tokenRefresh.js'
import GlobeModule from 'react-globe.gl'

const Globe = GlobeModule.default || GlobeModule;
const SEV_COLOR = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#3b82f6',
  info:     '#94a3b8'
}

// Destination coordinates for arcs (e.g. Frankfurt Data Center)
const DEST_LAT = 50.11
const DEST_LNG = 8.68

// A mapping function since randomIPs might not have exact real coordinates
function ipToLngLat(ip) {
  if (!ip) return null
  const ipStr = String(ip)
  const parts = ipStr.split('.').map(Number)
  if (parts.length !== 4) return null
  const [a, b, c, d] = parts
  
  const zones = {
    114: [104, 35],     // China
    1:   [104, 35],     // China
    14:  [104, 35],     // China
    27:  [104, 35],     // China
    42:  [104, 35],     // China
    58:  [104, 35],     // China
    60:  [104, 35],     // China
    101: [104, 35],     // China
    112: [104, 35],     // China
    183: [104, 35],     // China
    46:  [37, 55],      // Russia
    62:  [37, 55],      // Russia
    77:  [37, 55],      // Russia
    85:  [37, 55],      // Russia
    95:  [37, 55],      // Russia
    109: [37, 55],      // Russia
    178: [37, 55],      // Russia
    188: [37, 55],      // Russia
    212: [37, 55],      // Russia
    213: [37, 55],      // Russia
    104: [-95, 37],     // USA
    142: [-95, 37],     // USA
    13:  [-95, 37],     // USA
    52:  [-95, 37],     // USA
    192: [-95, 37],     // USA
    198: [-95, 37],     // USA
    23:  [-95, 37],     // USA
    71:  [-95, 37],     // USA
    98:  [-95, 37],     // USA
    199: [-95, 37],     // USA
    177: [-51, -14],    // Brazil
    187: [-51, -14],    // Brazil
    200: [-51, -14],    // Brazil
    189: [-51, -14],    // Brazil
    191: [-51, -14],    // Brazil
    41:  [8, 9],        // Nigeria
    102: [8, 9],        // Nigeria
    197: [8, 9],        // Nigeria
    144: [10, 51]       // Germany
  }
  
  const base = zones[a] || [-100 + (a % 180), -40 + (a % 80)]
  const jLng = ((b * 7 + c * 3) % 20) - 10
  const jLat = ((c * 5 + d * 11) % 20) - 10
  
  const lng = Math.max(-180, Math.min(180, base[0] + jLng))
  const lat = Math.max(-90, Math.min(90, base[1] + jLat))
  
  if (isNaN(lng) || isNaN(lat)) return null
  
  // Prevent Null Island (0,0) which looks like a bug pointing nowhere
  if (lng === 0 && lat === 0) return null
  
  return [lng, lat]
}

export default function SOCThreatMap() {
  const globeEl = useRef()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  
  // 3D Globe States
  const demoArcs = [
    { startLat: 37, startLng: -95, endLat: 41, endLng: 13, color: ['#ef4444', 'rgba(255,0,0,0)'], attack: { severity: 'critical', type: 'DDoS', source_ip: 'America -> Italy', created_at: Date.now() } },
    { startLat: 41, startLng: 13, endLat: -25, endLng: 133, color: ['#ef4444', 'rgba(255,0,0,0)'], attack: { severity: 'critical', type: 'SQLi', source_ip: 'Italy -> Australia', created_at: Date.now() } },
    { startLat: 51.5, startLng: -0.1, endLat: 48.8, endLng: 2.3, color: ['#ef4444', 'rgba(255,0,0,0)'], attack: { severity: 'critical', type: 'RCE', source_ip: 'London -> Paris', created_at: Date.now() } }
  ]
  const [arcsData, setArcsData] = useState([])
  const [hexData, setHexData] = useState([])
  const [ringData, setRingData] = useState([])
  const [hoverArc, setHoverArc] = useState(null)
  const [countries, setCountries] = useState({ features: [] })

  useEffect(() => {
    fetch('/countries.json')
      .then(res => res.json())
      .then(setCountries)
      .catch(err => console.error("Could not load countries:", err));
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch('/api/soc/threats')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json()
      setData(d)

      // Initialize Heatmap (HexBin) from Top IPs
      const newHexData = []
      ;(d.top_ips || []).forEach(ip => {
        const coords = ipToLngLat(ip.ip)
        if (coords) {
          // Weight the hexbin based on total events
          for (let i = 0; i < Math.min(ip.total, 20); i++) {
            newHexData.push({
              lat: coords[1],
              lng: coords[0],
              weight: ip.total,
              severity: ip.max_severity
            })
          }
        }
      })
      setHexData(newHexData)

      // Initialize Arcs and Rings from recent events
      const newArcsData = []
      const newRingData = []
      ;(d.recent_events || []).reverse().forEach(attack => {
        const coords = ipToLngLat(attack.source_ip)
        if (coords) {
          const color = SEV_COLOR[attack.severity] || '#3b82f6'
          // Add a small jitter so overlapping lines become visible
          const jitterLat = (Math.random() - 0.5) * 1.5
          const jitterLng = (Math.random() - 0.5) * 1.5
          newArcsData.push({
            startLat: coords[1] + (Math.random() - 0.5) * 0.5,
            startLng: coords[0] + (Math.random() - 0.5) * 0.5,
            endLat: DEST_LAT + jitterLat,
            endLng: DEST_LNG + jitterLng,
            color: [color, 'rgba(255, 255, 255, 0)'],
            attack
          })
          newRingData.push({
            lat: coords[1],
            lng: coords[0],
            color: color
          })
        }
      })
      setArcsData(newArcsData)
      setRingData(newRingData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Real-time Event Bus via SSE
  useEffect(() => {
    const token = sessionStorage.getItem('caspmail_access_token')
    const tenant = sessionStorage.getItem('caspmail_tenant') || 'acme-corp'
    if (!token) return

    let url = '/api/soc/stream?token=' + encodeURIComponent(token) + '&tenant_id=' + encodeURIComponent(tenant)
    const es = new EventSource(url)

    es.addEventListener('event', (e) => {
      try {
        const attack = JSON.parse(e.data)
        const coords = ipToLngLat(attack.source_ip)
        if (!coords) return

        const color = SEV_COLOR[attack.severity] || '#3b82f6'
        const jitterLat = (Math.random() - 0.5) * 1.5
        const jitterLng = (Math.random() - 0.5) * 1.5
        const arc = {
          startLat: coords[1] + (Math.random() - 0.5) * 0.5,
          startLng: coords[0] + (Math.random() - 0.5) * 0.5,
          endLat: DEST_LAT + jitterLat,
          endLng: DEST_LNG + jitterLng,
          color: [color, 'rgba(255, 255, 255, 0)'],
          attack
        }

        // Add arc to the map
        setArcsData(prev => [...prev.slice(-30), arc])
        
        // Add animated ripple/ring
        setRingData(prev => [...prev.slice(-15), {
          lat: coords[1],
          lng: coords[0],
          color: color
        }])

        // Add to heatmap
        setHexData(prev => [...prev, {
          lat: coords[1],
          lng: coords[0],
          weight: 1,
          severity: attack.severity
        }])
      } catch (err) {
        console.error("Error parsing event", err)
      }
    })

    return () => {
      es.close()
    }
  }, [])

  // Globe auto-rotation setup
  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.5
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2 })
    }
  }, [loading])

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Loading Map Data...</div>
  if (error) return <div className="h-full flex flex-col items-center justify-center text-red-400">
    <span>Failed to load map data</span>
    <span className="text-sm">{error}</span>
  </div>

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden rounded-xl border border-slate-800">
      
      {/* 3D WEBGL GLOBE */}
      <div className="absolute inset-0 cursor-move">
        <ErrorBoundary>
          <Globe
            ref={globeEl}
            globeImageUrl="/earth-dark.jpg"
            bumpImageUrl="/earth-topology.png"
            backgroundImageUrl="/night-sky.png"
            
            // Arcs (Attack Trajectories)
            arcsData={arcsData}
            arcStartLat={d => d.startLat}
            arcStartLng={d => d.startLng}
            arcEndLat={d => d.endLat}
            arcEndLng={d => d.endLng}
            arcColor={d => d.color}
            arcAltitudeAutoScale={0.4}
            arcAltitude={d => d.altitude || (0.2 + Math.random() * 0.3)}
            arcDashLength={0.8}
            arcDashGap={0.1}
            arcDashAnimateTime={800}
            arcStroke={0.4}
            arcCircularResolution={64}
            onArcHover={setHoverArc}

            // Rings (Attack Origins)
            ringsData={ringData}
            ringColor={d => d.color}
            ringMaxRadius={5}
            ringPropagationSpeed={2}
            ringRepeatPeriod={1000}

            // Country Polygons
            polygonsData={countries.features ? countries.features.filter(d => d.properties?.NAME !== 'Antarctica' && d.properties?.name !== 'Antarctica') : []}
            polygonAltitude={0.005}
            polygonCapColor={() => 'rgba(20, 30, 45, 0.7)'}
            polygonSideColor={() => 'rgba(0, 0, 0, 0.2)'}
            polygonStrokeColor={() => '#334155'}

            // Heatmap (HexBin)
            hexBinPointsData={hexData}
            hexBinPointWeight={d => d.weight}
            hexBinResolution={4}
            hexMargin={0.2}
            hexTopColor={d => SEV_COLOR[d.points[0]?.severity] || '#3b82f6'}
            hexSideColor={d => SEV_COLOR[d.points[0]?.severity] || '#3b82f6'}
            hexAltitude={0.01}
            hexBinMerge={true}
            hexTransitionDuration={1000}
          />
        </ErrorBoundary>
      </div>

      {/* OVERLAYS & UI */}
      <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 p-4 rounded-lg flex flex-col gap-1 min-w-[250px]">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Global Threat Map
          </h2>
          <p className="text-xs text-slate-400">Real-time WebGL visualization of inbound attacks via Event Bus.</p>
        </div>
        
        {hoverArc && hoverArc.attack && hoverArc.attack.raw && (
          <div className="bg-slate-900/90 backdrop-blur border border-cyan-500/30 p-4 rounded-lg flex flex-col gap-2 max-w-[300px] shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-slate-800 pb-2">
              <Target className="w-4 h-4" />
              Intercepted Attack
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <span className="text-slate-400">Source IP:</span>
              <span className="text-slate-100 font-mono">{hoverArc.attack.source_ip}</span>
              
              <span className="text-slate-400">Type:</span>
              <span className="text-slate-100">{hoverArc.attack.type}</span>
              
              <span className="text-slate-400">MITRE Tactic:</span>
              <span className="text-orange-400 font-mono bg-orange-500/10 px-1 rounded">{hoverArc.attack.raw.mitre_tactic}</span>
              
              <span className="text-slate-400">MITRE Tech:</span>
              <span className="text-rose-400 font-mono bg-rose-500/10 px-1 rounded">{hoverArc.attack.raw.mitre_technique}</span>
              
              <span className="text-slate-400">UEBA Score:</span>
              <span className={`font-bold ${hoverArc.attack.raw.ueba_score > 80 ? 'text-rose-500' : 'text-amber-400'}`}>
                {hoverArc.attack.raw.ueba_score} / 100
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 p-4 rounded-lg flex flex-col gap-2">
           <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
             <Activity className="w-3 h-3 text-cyan-400" />
             Live Event Timeline
           </h3>
           <div className="overflow-x-auto overflow-y-auto max-h-[160px] pointer-events-auto no-scrollbar flex justify-center">
             <table className="mx-auto text-center text-xs border-collapse w-full max-w-4xl">
               <thead className="sticky top-0 bg-slate-900/90 backdrop-blur z-10">
                 <tr className="border-b border-slate-700 text-slate-400">
                   <th className="py-2 px-4 font-semibold text-center align-middle">Time</th>
                   <th className="py-2 px-4 font-semibold text-center align-middle">Severity</th>
                   <th className="py-2 px-4 font-semibold text-center align-middle">Source IP</th>
                   <th className="py-2 px-4 font-semibold text-center align-middle">Type</th>
                 </tr>
               </thead>
               <tbody>
                 {arcsData.slice(-15).reverse().map((arc, i) => (
                   <tr key={i} className="border-b border-slate-800 hover:bg-slate-700/80 transition-all cursor-default">
                     <td className="py-2 px-4 text-slate-500 whitespace-nowrap text-center align-middle">{new Date(arc.attack.created_at || Date.now()).toLocaleTimeString()}</td>
                     <td className="py-2 px-4 font-bold uppercase tracking-wider whitespace-nowrap text-center align-middle" style={{ color: arc.color[0] }}>{arc.attack.severity}</td>
                     <td className="py-2 px-4 text-slate-300 font-mono whitespace-nowrap text-center align-middle">{arc.attack.source_ip}</td>
                     <td className="py-2 px-4 text-slate-400 truncate max-w-[200px] text-center align-middle">{arc.attack.type}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>

    </div>
  )
}
