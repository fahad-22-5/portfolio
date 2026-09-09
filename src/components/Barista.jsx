import React, { useState, useRef, useEffect } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Text, RoundedBox } from '@react-three/drei';
import { useSpring, animated, config } from '@react-spring/three';
import * as THREE from 'three';
import './Barista.css';

// --- Recipes & Logic ---
const RECIPES = [
  { name: 'Espresso', ingredients: ['espresso'] },
  { name: 'Double Espresso', ingredients: ['espresso', 'espresso'] },
  { name: 'Americano', ingredients: ['espresso', 'water'] },
  { name: 'Double Americano', ingredients: ['espresso', 'espresso', 'water'] },
  { name: 'Iced Americano', ingredients: ['espresso', 'water', 'ice'] },
  { name: 'Latte', ingredients: ['espresso', 'steamed_milk'] },
  { name: 'Double Latte', ingredients: ['espresso', 'espresso', 'steamed_milk'] },
  { name: 'Iced Latte', ingredients: ['espresso', 'steamed_milk', 'ice'] },
  { name: 'Water', ingredients: ['water'] },
  { name: 'Ice Water', ingredients: ['water', 'ice'] },
  { name: 'Milk', ingredients: ['milk'] },
  { name: 'Iced Milk', ingredients: ['milk', 'ice'] },
];

function evaluateDrink(contents) {
  if (!contents || contents.length === 0) return null;
  const currentMix = [...contents].sort().join(',');
  const found = RECIPES.find((r) => [...r.ingredients].sort().join(',') === currentMix);
  return found ? found.name : 'Mystery Brew 🤔';
}

function getLiquidColor(contents) {
  if (!contents || contents.length === 0) return 'transparent';
  if (contents.includes('espresso') && contents.includes('steamed_milk')) return '#c29a76';
  if (contents.includes('espresso') && contents.includes('water')) return '#4a3320';
  if (contents.includes('espresso')) return '#3b2818';
  if (contents.includes('steamed_milk') || contents.includes('milk')) return '#ffffff';
  if (contents.includes('water')) return '#88ccff';
  return '#ff00ff';
}

// --- 3D Sub-Components ---
function Liquid({ contents, heightMultiplier = 1 }) {
  const fillLevel = Math.min(contents.length * 0.3 * heightMultiplier, heightMultiplier);
  const color = getLiquidColor(contents);

  // Animate the liquid filling up and changing color
  const { scaleY, posY, liquidColor, opacity } = useSpring({
    scaleY: fillLevel === 0 ? 0.01 : fillLevel,
    posY: fillLevel === 0 ? 0.05 : (fillLevel / 2) - (heightMultiplier / 2) + 0.05,
    liquidColor: color,
    opacity: fillLevel === 0 ? 0 : 0.9,
    config: config.wobbly
  });

  return (
    <animated.mesh position-y={posY} scale-y={scaleY}>
      <cylinderGeometry args={[0.38, 0.38, 1, 32]} />
      <animated.meshPhysicalMaterial 
        color={liquidColor} 
        transmission={0.2}
        transparent={true}
        opacity={opacity}
        roughness={0.1}
      />
    </animated.mesh>
  );
}

function GlassCup({ type, contents, selected, onClick, position }) {
  const isTall = type === 'tall_glass';
  const height = isTall ? 1.5 : 0.6;
  const radius = isTall ? 0.4 : 0.35;
  
  const [hovered, setHovered] = useState(false);

  // Smooth position and scale transitions
  const { pos, scale } = useSpring({
    pos: position,
    scale: hovered ? 1.05 : (selected ? 1.1 : 1),
    config: config.stiff
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  return (
    <animated.group 
      position={pos} 
      scale={scale}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Selection Highlight */}
      {selected && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[radius + 0.1, radius + 0.1, 0.1, 32]} />
          <meshBasicMaterial color="#00ff00" transparent opacity={0.5} />
        </mesh>
      )}
      {/* Glass Body */}
      <mesh position={[0, height/2, 0]} castShadow>
        <cylinderGeometry args={[radius, radius - 0.05, height, 32]} />
        <meshPhysicalMaterial 
          transmission={0.9} 
          opacity={1} 
          transparent 
          roughness={0.1} 
          ior={1.5} 
          color="#ffffff" 
        />
      </mesh>
      {/* Liquid Contents */}
      <group position={[0, height/2, 0]}>
        <Liquid contents={contents} heightMultiplier={height - 0.1} />
      </group>
      
      {/* Label above cup */}
      {contents && contents.length > 0 && (
        <Text position={[0, height + 0.3, 0]} fontSize={0.2} color="white" anchorY="bottom">
          {evaluateDrink(contents) || contents.join(', ')}
        </Text>
      )}
    </animated.group>
  );
}

function Pitcher({ contents, selected, onClick, position, isSteaming }) {
  const height = 1.2;
  const radius = 0.4;
  
  const [hovered, setHovered] = useState(false);
  const { pos, scale } = useSpring({
    pos: position,
    scale: hovered ? 1.05 : (selected ? 1.1 : 1),
    config: config.stiff
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  // Steaming shake effect
  const steamRef = useRef();
  useFrame(({ clock }) => {
    if (isSteaming && steamRef.current) {
      steamRef.current.position.x = Math.sin(clock.elapsedTime * 40) * 0.02;
    } else if (steamRef.current) {
      steamRef.current.position.x = 0;
    }
  });

  return (
    <animated.group 
      position={pos} 
      scale={scale}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      <group ref={steamRef}>
        {selected && (
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[radius + 0.1, radius + 0.1, 0.1, 32]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.5} />
          </mesh>
        )}
        <mesh position={[0, height/2, 0]} castShadow>
          <cylinderGeometry args={[radius, radius, height, 32]} />
          <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[radius + 0.15, height/2, 0]} castShadow>
          <boxGeometry args={[0.3, 0.6, 0.1]} />
          <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {isSteaming && (
          <Text position={[0, height + 0.3, 0]} fontSize={0.2} color="#00ff00">STEAMING...</Text>
        )}
        {!isSteaming && contents && contents.length > 0 && (
          <Text position={[0, height + 0.3, 0]} fontSize={0.2} color="white">
            {contents.includes('steamed_milk') ? 'Steamed Milk' : 'Milk'}
          </Text>
        )}
      </group>
    </animated.group>
  );
}

function EspressoMachine({ machineState, steamState, onBrew, onSteam }) {
  const brewHover = useRef(false);
  const steamHover = useRef(false);
  const [bHover, setBHover] = useState(false);
  const [sHover, setSHover] = useState(false);

  const { brewScale } = useSpring({ brewScale: bHover ? 1.1 : 1 });
  const { steamScale } = useSpring({ steamScale: sHover ? 1.1 : 1 });

  return (
    <group position={[0, 0, -1.5]}>
      {/* Main Body */}
      <RoundedBox args={[4, 3, 2]} position={[0, 1.5, 0]} radius={0.1} castShadow receiveShadow>
        <meshStandardMaterial color="#222" metalness={0.7} roughness={0.3} />
      </RoundedBox>
      
      {/* Control Panel Area */}
      <mesh position={[0, 2.5, 1.01]}>
        <planeGeometry args={[3, 0.6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <Text position={[0, 2.5, 1.02]} fontSize={0.2} color="#ccc">FAHAD-X ESPRESSO</Text>

      {/* Group Spout */}
      <mesh position={[0, 1.2, 0.8]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 16]} />
        <meshStandardMaterial color="#555" metalness={0.9} />
      </mesh>
      
      {/* Steam Wand */}
      <mesh position={[1.2, 1.2, 0.8]} rotation={[0, 0, -Math.PI/6]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 16]} />
        <meshStandardMaterial color="#bbb" metalness={0.9} />
      </mesh>

      {/* Brew Button */}
      <animated.group 
        position={[-0.8, 2, 1]} 
        scale={brewScale}
        onClick={(e) => { e.stopPropagation(); onBrew(); }}
        onPointerOver={(e) => { e.stopPropagation(); setBHover(true); document.body.style.cursor='pointer'; }}
        onPointerOut={() => { setBHover(false); document.body.style.cursor='auto'; }}
      >
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color={machineState === 'ready' ? '#ff3b30' : '#881111'} />
        <Text position={[0, -0.3, 0.05]} fontSize={0.12} color="white">BREW</Text>
      </animated.group>

      {/* Steam Button */}
      <animated.group 
        position={[1.2, 2, 1]} 
        scale={steamScale}
        onClick={(e) => { e.stopPropagation(); onSteam(); }}
        onPointerOver={(e) => { e.stopPropagation(); setSHover(true); document.body.style.cursor='pointer'; }}
        onPointerOut={() => { setSHover(false); document.body.style.cursor='auto'; }}
      >
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color={steamState === 'ready' ? '#007aff' : '#003366'} />
        <Text position={[0, -0.3, 0.05]} fontSize={0.12} color="white">STEAM</Text>
      </animated.group>

      {/* Drip Tray */}
      <mesh position={[0, 0.1, 1]} receiveShadow>
        <boxGeometry args={[3.8, 0.2, 1.5]} />
        <meshStandardMaterial color="#111" metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.21, 1]}>
        <planeGeometry args={[3.6, 1.3]} />
        <meshStandardMaterial color="#666" metalness={0.9} />
      </mesh>
    </group>
  );
}

// --- Main Application ---
export default function Barista() {
  const idRef = useRef(0);
  const nextId = () => { idRef.current += 1; return idRef.current; };

  const [slots, setSlots] = useState([null, null, null, null, null]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  const [machineState, setMachineState] = useState('ready');
  const [steamState, setSteamState] = useState('ready');

  const [telemetry, setTelemetry] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [eventLogs, setEventLogs] = useState([{ id: 0, text: '[SYS] Initializing 3D Interface...', type: 'info' }]);
  const connectionRef = useRef(null);

  const addLog = (text, type = 'info') => {
    setEventLogs(prev => [...prev.slice(-14), { id: Date.now() + Math.random(), text, type }]);
  };

  useEffect(() => {
    let isMounted = true;
    const connection = new HubConnectionBuilder()
      .withUrl("http://localhost:5095/coffeehub")
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.on("ReceiveTelemetry", (data) => { if (isMounted) setTelemetry(data); });
    connection.on("ReceiveActionLog", (message, type) => { if (isMounted) addLog(message, type); });

    const startConnection = async () => {
      if (!isMounted) return;
      try {
        await connection.start();
        if (isMounted) { setIsConnected(true); addLog('[SYS] Backend Connected', 'info'); }
      } catch (err) {
        if (isMounted) { setIsConnected(false); addLog('[ERR] Backend offline.', 'error'); }
      }
    };

    startConnection();
    connectionRef.current = connection;
    return () => { isMounted = false; connection.stop(); };
  }, []);

  useEffect(() => {
    setSlots([
      { id: nextId(), kind: 'glass', type: 'tall_glass', contents: [] },
      { id: nextId(), kind: 'glass', type: 'espresso_cup', contents: [] },
      { id: nextId(), kind: 'tool', type: 'frothing_pitcher', contents: [] },
      null, null
    ]);
  }, []);

  const SLOT_POSITIONS = [
    [-2.5, 0, 1.5], [0, 0, 1.5], [2.5, 0, 1.5],
    [0, 0.22, -0.7], [1.2, 0.22, -0.7]
  ];

  const handleSlotClick = (idx) => {
    if (selectedSlot === null) {
      if (slots[idx]) setSelectedSlot(idx);
    } else {
      if (selectedSlot === idx) {
        setSelectedSlot(null);
      } else {
        const source = slots[selectedSlot];
        const target = slots[idx];
        if (!target) {
          const newSlots = [...slots];
          newSlots[idx] = source;
          newSlots[selectedSlot] = null;
          setSlots(newSlots);
        } else {
          if (source.contents.length > 0) {
            const newSlots = [...slots];
            newSlots[idx] = { ...target, contents: [...target.contents, ...source.contents] };
            newSlots[selectedSlot] = { ...source, contents: [] };
            setSlots(newSlots);
            addLog('Poured liquid', 'action');
          }
        }
        setSelectedSlot(null);
      }
    }
  };

  const addIngredientToSelected = (ingredient) => {
    if (selectedSlot !== null && slots[selectedSlot]) {
      const item = slots[selectedSlot];
      const newSlots = [...slots];
      newSlots[selectedSlot] = { ...item, contents: [...item.contents, ingredient] };
      setSlots(newSlots);
      addLog(`Added ${ingredient}`, 'action');
    } else {
      addLog('Select a cup first!', 'error');
    }
  };

  const spawnItem = (type, kind) => {
    const emptyIdx = slots.findIndex(s => s === null);
    if (emptyIdx !== -1) {
      const newSlots = [...slots];
      newSlots[emptyIdx] = { id: nextId(), kind, type, contents: [] };
      setSlots(newSlots);
      addLog(`Spawned ${type}`, 'action');
    } else {
      addLog('No empty slots on table!', 'error');
    }
  };

  const serveDrink = () => {
    if (selectedSlot !== null && slots[selectedSlot]) {
      const item = slots[selectedSlot];
      const drinkName = evaluateDrink(item.contents);
      addLog(`Served: ${drinkName}!`, 'action');
      const newSlots = [...slots];
      newSlots[selectedSlot] = null;
      setSlots(newSlots);
      setSelectedSlot(null);
    }
  };

  const trashItem = () => {
    if (selectedSlot !== null) {
      const newSlots = [...slots];
      newSlots[selectedSlot] = null;
      setSlots(newSlots);
      setSelectedSlot(null);
      addLog('Trashed item', 'action');
    }
  };

  const brewEspresso = () => {
    if (machineState !== 'ready') return;
    const dripSlot = slots[3];
    if (!dripSlot) { addLog('Place cup on drip tray!', 'error'); return; }
    
    if (connectionRef.current && isConnected) {
      connectionRef.current.invoke("TriggerMachineAction", "Brew").catch(e => console.error(e));
    }

    setMachineState('grinding');
    addLog('Grinding beans...', 'info');
    setTimeout(() => {
      setMachineState('brewing');
      addLog('Brewing espresso...', 'info');
      setTimeout(() => {
        setMachineState('ready');
        const newSlots = [...slots];
        newSlots[3] = { ...dripSlot, contents: [...dripSlot.contents, 'espresso'] };
        setSlots(newSlots);
        addLog('Shot pulled.', 'info');
      }, 2000);
    }, 1000);
  };

  const steamMilk = () => {
    if (steamState !== 'ready') return;
    const sSlot = slots[4];
    if (!sSlot || sSlot.type !== 'frothing_pitcher' || !sSlot.contents.includes('milk')) {
      addLog('Place pitcher with milk under wand!', 'error');
      return;
    }
    
    if (connectionRef.current && isConnected) {
      connectionRef.current.invoke("TriggerMachineAction", "Steam").catch(e => console.error(e));
    }

    setSteamState('steaming');
    addLog('Steaming milk...', 'info');
    setTimeout(() => {
      setSteamState('ready');
      const newSlots = [...slots];
      const newContents = sSlot.contents.map(x => x === 'milk' ? 'steamed_milk' : x);
      newSlots[4] = { ...sSlot, contents: newContents };
      setSlots(newSlots);
      addLog('Milk steamed.', 'info');
    }, 2500);
  };

  return (
    <div className="barista-container">
      <div className="barista-header">
        <h1>Barista 3D</h1>
        <div className="header-actions">
          <button onClick={() => spawnItem('espresso_cup', 'glass')}>+ Espresso Cup</button>
          <button onClick={() => spawnItem('tall_glass', 'glass')}>+ Tall Glass</button>
          <button onClick={() => spawnItem('frothing_pitcher', 'tool')}>+ Pitcher</button>
        </div>
      </div>

      <div className={`status-overlay ${!isConnected ? 'offline' : ''}`}>
        <div>{isConnected ? '🟢 SYSTEM ONLINE' : '🔴 OFFLINE'}</div>
        {telemetry && (
          <div style={{ marginTop: 10, fontSize: '0.8rem' }}>
            <div>Temp: {telemetry.temperature.toFixed(1)}°C</div>
            <div>Pressure: {telemetry.pressure.toFixed(1)} bar</div>
            <div>Water: {telemetry.waterLevel.toFixed(1)}L</div>
          </div>
        )}
        <div className="logs">
          {eventLogs.map(log => (
            <div key={log.id} className={`log-${log.type}`}>{log.text}</div>
          ))}
        </div>
      </div>

      <div className="instruction-text">
        1. Click a cup to select it.<br/>
        2. Click an empty slot to move it.<br/>
        3. Click another cup to pour.<br/>
        4. Use UI below to add ingredients.
      </div>

      <div className="overlay-ui">
        <div className="overlay-panel">
          <div className="panel-title">Add Ingredients to Selected</div>
          <div className="button-row">
            <button className="ing-btn" onClick={() => addIngredientToSelected('water')}>Water</button>
            <button className="ing-btn" onClick={() => addIngredientToSelected('milk')}>Milk</button>
            <button className="ing-btn" onClick={() => addIngredientToSelected('ice')}>Ice</button>
          </div>
        </div>
        <div className="overlay-panel" style={{ borderColor: 'rgba(255, 50, 50, 0.3)' }}>
           <div className="panel-title">Actions</div>
           <div className="button-row">
             <button className="ing-btn" style={{ background: '#2a4a35' }} onClick={serveDrink}>Serve Drink</button>
             <button className="ing-btn" style={{ background: '#4a2a2a' }} onClick={trashItem}>Trash Item</button>
           </div>
        </div>
      </div>

      <div className="kitchen-scene">
        <Canvas shadows camera={{ position: [0, 4, 8], fov: 45 }}>
          <Environment preset="city" background blur={0.8} />
          <ambientLight intensity={0.5} />
          <directionalLight castShadow position={[5, 10, 5]} intensity={1.5} shadow-mapSize={[1024, 1024]} />
          <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.1} minDistance={4} maxDistance={15} />
          
          <mesh receiveShadow position={[0, -0.5, 1.5]}>
            <boxGeometry args={[10, 1, 4]} />
            <meshStandardMaterial color="#3a2b22" roughness={0.8} />
          </mesh>

          <EspressoMachine machineState={machineState} steamState={steamState} onBrew={brewEspresso} onSteam={steamMilk} />

          {/* Render Slots & Items */}
          {slots.map((item, idx) => {
            const pos = SLOT_POSITIONS[idx];
            const isTableSlot = idx < 3;
            const slotMarker = isTableSlot && (
              <mesh 
                position={[pos[0], 0.01, pos[2]]} 
                rotation={[-Math.PI/2, 0, 0]}
                onClick={(e) => { e.stopPropagation(); handleSlotClick(idx); }}
                onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor='pointer'; }}
                onPointerOut={() => { document.body.style.cursor='auto'; }}
              >
                <ringGeometry args={[0.4, 0.45, 32]} />
                <meshBasicMaterial color={selectedSlot === idx ? '#00ff00' : '#ffffff'} opacity={0.2} transparent />
              </mesh>
            );

            let itemMesh = null;
            if (item) {
              const isSelected = selectedSlot === idx;
              if (item.type === 'frothing_pitcher') {
                itemMesh = <Pitcher 
                  contents={item.contents} 
                  selected={isSelected}
                  isSteaming={idx === 4 && steamState === 'steaming'}
                  position={pos}
                  onClick={() => handleSlotClick(idx)}
                />;
              } else {
                itemMesh = <GlassCup 
                  type={item.type} 
                  contents={item.contents} 
                  selected={isSelected}
                  position={pos}
                  onClick={() => handleSlotClick(idx)}
                />;
              }
            } else if (idx === 3 || idx === 4) {
               itemMesh = (
                 <mesh 
                  position={[pos[0], pos[1] + 0.3, pos[2]]} 
                  onClick={(e) => { e.stopPropagation(); handleSlotClick(idx); }}
                  onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor='pointer'; }}
                  onPointerOut={() => { document.body.style.cursor='auto'; }}
                 >
                   <boxGeometry args={[1, 1, 1]} />
                   <meshBasicMaterial visible={false} />
                 </mesh>
               );
            }

            return (
              <group key={`slot-${idx}`}>
                {slotMarker}
                {itemMesh}
              </group>
            );
          })}
        </Canvas>
      </div>
    </div>
  );
}
