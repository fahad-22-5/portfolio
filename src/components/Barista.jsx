import React, { useState, useRef, useEffect } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import './Barista.css';

/* ── Recipe Engine ── */
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

/* ── Definitions ── */
const SERVING_GLASSES = [
  { id: 'espresso_cup', label: 'Espresso Cup' },
  { id: 'tall_glass', label: 'Tall Glass' },
];

const CROCKERY_TOOLS = [
  { id: 'shot_glass', label: 'Shot Glass', purpose: 'Catch espresso from machine' },
  { id: 'frothing_pitcher', label: 'Frothing Pitcher', purpose: 'Steam milk' },
];

const INGREDIENTS = [
  { id: 'water', label: 'Water', img: '/assets/water_pitcher.png' },
  { id: 'milk', label: 'Milk', img: '/assets/milk_jug.png' },
  { id: 'ice', label: 'Ice', img: '/assets/ice_bucket.png' },
];

/* ── Image Mapping ── */
const TALL_GLASS_IMAGES = {
  '': '/assets/tall_glass_empty.png',
  'espresso': '/assets/tall_glass_espresso.png',
  'water': '/assets/tall_glass_water.png',
  'milk': '/assets/tall_glass_milk.png',
  'ice': '/assets/tall_glass_ice.png',
  'espresso,water': '/assets/tall_glass_americano.png',
  'espresso,ice,water': '/assets/tall_glass_iced_americano.png',
  'espresso,steamed_milk': '/assets/tall_glass_latte.png',
  'espresso,ice,steamed_milk': '/assets/tall_glass_iced_latte.png',
  'ice,water': '/assets/tall_glass_iced_water.png',
  'ice,milk': '/assets/tall_glass_iced_milk.png',
  'steamed_milk': '/assets/tall_glass_milk.png',
  'ice,steamed_milk': '/assets/tall_glass_iced_milk.png',
};

function getServingGlassImg(glassType, contents) {
  if (glassType === 'tall_glass') {
    const key = [...(contents || [])].sort().join(',');
    return TALL_GLASS_IMAGES[key] || '/assets/tall_glass_empty.png';
  }
  if (glassType === 'espresso_cup') {
    return contents && contents.length > 0
      ? '/assets/espresso_cup_filled.png'
      : '/assets/espresso_cup_empty.png';
  }
  return '/assets/tall_glass_empty.png';
}

function getToolImg(toolType, isFull) {
  if (toolType === 'shot_glass') {
    return isFull ? '/assets/shot_glass_full.png' : '/assets/shot_glass_empty.png';
  }
  if (toolType === 'frothing_pitcher') {
    return isFull ? '/assets/frothing_pitcher_full.png' : '/assets/frothing_pitcher_empty.png';
  }
  return '/assets/shot_glass_empty.png';
}

function getSlotImg(slot) {
  if (!slot) return null;
  if (slot.kind === 'tool') return getToolImg(slot.toolType, slot.contents.length > 0);
  if (slot.kind === 'glass') return getServingGlassImg(slot.glassType, slot.contents);
  return null;
}

/* ── Main Component ── */
export default function Barista() {
  const idRef = useRef(0);
  const nextId = () => { idRef.current += 1; return idRef.current; };

  // Machine drip tray
  const [machineSlot, setMachineSlot] = useState(null);

  // Steam wand slot
  const [steamSlot, setSteamSlot] = useState(null); // { kind: 'pitcher', contents: ['milk'], state: 'ready'|'steaming' }
  const [telemetry, setTelemetry] = useState(null);
  const [showServedDrinks, setShowServedDrinks] = useState(true);
  const [showNerdPopup, setShowNerdPopup] = useState(false);
  const [statsForNerds, setStatsForNerds] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [eventLogs, setEventLogs] = useState([{ id: 0, text: '[SYS] Initializing sensors...', type: 'info' }]);
  const addLog = (text, type = 'info') => {
    setEventLogs(prev => [...prev.slice(-14), { id: Date.now() + Math.random(), text, type }]);
  };

  const emitActionLog = (text, type = 'info', prefix = '[ACTION]') => {
    const formattedText = `${prefix} ${text}`;
    if (connectionRef.current && isConnected) {
      connectionRef.current.invoke("BroadcastActionLog", formattedText, type).catch(err => console.error(err));
    } else {
      addLog(formattedText, type);
    }
  };

  const connectionRef = useRef(null);
  const logOutputRef = useRef(null);

  useEffect(() => {
    if (logOutputRef.current) {
      logOutputRef.current.scrollTop = logOutputRef.current.scrollHeight;
    }
  }, [eventLogs, telemetry]);

  useEffect(() => {
    let isMounted = true;

    const customRetryPolicy = {
      nextRetryDelayInMilliseconds: () => 3000
    };

    const connection = new HubConnectionBuilder()
      .withUrl("http://localhost:5095/coffeehub")
      .withAutomaticReconnect(customRetryPolicy)
      .configureLogging(LogLevel.Information)
      .build();

    connection.on("ReceiveTelemetry", (data) => {
      if (isMounted) setTelemetry(data);
    });
    
    connection.on("ReceiveActionLog", (message, type) => {
      if (isMounted) {
        setEventLogs(prev => [...prev.slice(-14), { id: Date.now() + Math.random(), text: message, type }]);
      }
    });
    
    connection.onreconnecting(() => {
      if (isMounted) {
        setIsConnected(false);
        setEventLogs(prev => [...prev.slice(-14), { id: Date.now(), text: '[ERR] Connection lost. Reconnecting...', type: 'error' }]);
      }
    });
    
    connection.onreconnected(() => {
      if (isMounted) {
        setIsConnected(true);
        setEventLogs(prev => [...prev.slice(-14), { id: Date.now(), text: '[SYS] Connection re-established', type: 'success' }]);
      }
    });

    connection.onclose(() => {
      if (isMounted) {
        setIsConnected(false);
        setEventLogs(prev => [...prev.slice(-14), { id: Date.now(), text: '[ERR] Connection closed.', type: 'error' }]);
      }
    });

    const startConnection = async () => {
      if (!isMounted) return;
      try {
        await connection.start();
        if (isMounted) {
          setIsConnected(true);
          setEventLogs(prev => [...prev.slice(-14), { id: Date.now(), text: '[SYS] Connection established', type: 'success' }]);
        }
      } catch (err) {
        if (isMounted) {
          setIsConnected(false);
          setEventLogs(prev => [...prev.slice(-14), { id: Date.now(), text: '[ERR] Backend offline. Retrying...', type: 'error' }]);
          console.log(`Initial connection failed. Retrying in 3s...`);
          setTimeout(startConnection, 3000);
        }
      }
    };

    startConnection();
    connectionRef.current = connection;

    return () => {
      isMounted = false;
      connection.stop();
    };
  }, []);

  // Counter: 3 workspace slots
  const [counter, setCounter] = useState([null, null, null]);

  // Finished drinks
  const [finished, setFinished] = useState([]);

  /* ── Drag Helpers ── */
  const dStart = (e, data) => e.dataTransfer.setData('application/json', JSON.stringify(data));
  const dOver = (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); };
  const dLeave = (e) => e.currentTarget.classList.remove('drag-over');
  const getData = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const raw = e.dataTransfer.getData('application/json');
    try { return JSON.parse(raw); } catch { return null; }
  };

  /* ── Helper: find first empty counter slot ── */
  const firstEmptySlot = () => counter.findIndex(s => s === null);

  /* ── Crockery: Grab tool → goes to counter ── */
  const grabTool = (toolType) => {
    const idx = firstEmptySlot();
    if (idx === -1) return; // no empty slots
    const c = [...counter];
    c[idx] = { id: nextId(), kind: 'tool', toolType, contents: [] };
    setCounter(c);
    emitActionLog(`Grabbed ${toolType.replace('_', ' ')}`);
  };

  /* ── DROP: Counter slot item or Shelf Tool → Machine/Steam Wand ── */
  const onDropMachine = (e) => {
    const d = getData(e);
    if (!d) return;

    // If it's a frothing pitcher, route it to the steam wand!
    if (d.toolType === 'frothing_pitcher') {
      if (steamSlot) return;
      if (d.type === 'shelf_tool') {
        setSteamSlot({ id: nextId(), toolType: 'frothing_pitcher', state: 'ready', contents: [] });
        emitActionLog("Placed pitcher on steam wand");
      } else if (d.type === 'counter_item') {
        const slot = counter[d.slotIndex];
        if (slot) {
          setSteamSlot({ id: slot.id, toolType: 'frothing_pitcher', state: 'ready', contents: [...slot.contents] });
          const c = [...counter];
          c[d.slotIndex] = null;
          setCounter(c);
          emitActionLog("Moved pitcher to steam wand");
        }
      }
      return;
    }

    // Otherwise, handle shot glass for the drip tray
    if (machineSlot) return;
    if (d.type === 'shelf_tool' && d.toolType === 'shot_glass') {
      setMachineSlot({ id: nextId(), toolType: 'shot_glass', state: 'empty', shots: 0 });
      emitActionLog("Placed shot glass on machine");
      return;
    }

    if (d.type === 'counter_item' && d.kind === 'tool' && d.toolType === 'shot_glass') {
      const slot = counter[d.slotIndex];
      if (slot) {
        setMachineSlot({
          id: slot.id,
          toolType: 'shot_glass',
          state: slot.contents.length > 0 ? 'ready' : 'empty',
          shots: slot.contents.length,
        });
        const c = [...counter];
        c[d.slotIndex] = null;
        setCounter(c);
        emitActionLog("Moved shot glass to machine");
      }
    }
  };

  const onDropSteamWand = (e) => {
    const d = getData(e);
    if (!d) return;

    // If it's a shot glass, route it to the main drip tray!
    if (d.toolType === 'shot_glass') {
      onDropMachine({ ...e, dataTransfer: { getData: () => JSON.stringify(d) }, preventDefault: () => {}, currentTarget: { classList: { remove: () => {} } } });
      // Actually simpler: just duplicate the route logic for safety
      if (machineSlot) return;
      if (d.type === 'shelf_tool') {
        setMachineSlot({ id: nextId(), toolType: 'shot_glass', state: 'empty', shots: 0 });
        emitActionLog("Placed shot glass on machine");
      } else if (d.type === 'counter_item') {
        const slot = counter[d.slotIndex];
        if (slot) {
          setMachineSlot({ id: slot.id, toolType: 'shot_glass', state: slot.contents.length > 0 ? 'ready' : 'empty', shots: slot.contents.length });
          const c = [...counter];
          c[d.slotIndex] = null;
          setCounter(c);
          emitActionLog("Moved shot glass to machine");
        }
      }
      return;
    }

    // Normal steam wand logic
    if (steamSlot) return;
    if (d.type === 'shelf_tool' && d.toolType === 'frothing_pitcher') {
      setSteamSlot({ id: nextId(), toolType: 'frothing_pitcher', state: 'ready', contents: [] });
      emitActionLog("Placed pitcher on steam wand");
      return;
    }

    if (d.type === 'counter_item' && d.kind === 'tool' && d.toolType === 'frothing_pitcher') {
      const slot = counter[d.slotIndex];
      if (slot) {
        setSteamSlot({
          id: slot.id,
          toolType: 'frothing_pitcher',
          state: 'ready',
          contents: [...slot.contents],
        });
        const c = [...counter];
        c[d.slotIndex] = null;
        setCounter(c);
        emitActionLog("Moved pitcher to steam wand");
      }
    }
  };

  /* ── DROP: Machine glass → Counter ── */
  const onDropCounterSlot = (e, idx) => {
    const d = getData(e);
    if (!d) return;
    const c = [...counter];

    if (d.type === 'shelf_tool' && !c[idx]) {
      c[idx] = { id: nextId(), kind: 'tool', toolType: d.toolType, contents: [] };
      setCounter(c);
      emitActionLog(`Placed ${d.toolType.replace('_', ' ')} on counter`);
      return;
    }

    if (d.type === 'machine_glass' && machineSlot) {
      if (!c[idx]) {
        const contents = [];
        for (let i = 0; i < machineSlot.shots; i++) contents.push('espresso');
        c[idx] = { id: machineSlot.id, kind: 'tool', toolType: machineSlot.toolType, contents };
        setCounter(c);
        setMachineSlot(null);
        emitActionLog("Moved espresso shot to counter");
        return;
      } else if (c[idx].kind === 'glass' && machineSlot.shots > 0) {
        const contents = [];
        for (let i = 0; i < machineSlot.shots; i++) contents.push('espresso');
        c[idx] = { ...c[idx], contents: [...c[idx].contents, ...contents] };
        setCounter(c);
        setMachineSlot(null);
        emitActionLog("Poured espresso into cup");
        return;
      }
    }

    if (d.type === 'cupboard_glass' && !c[idx]) {
      c[idx] = { id: nextId(), kind: 'glass', glassType: d.glassType, contents: [] };
      setCounter(c);
      emitActionLog(`Placed ${d.glassType.replace('_', ' ')} on counter`);
      return;
    }

    if (d.type === 'ingredient' && c[idx]) {
      c[idx] = { ...c[idx], contents: [...c[idx].contents, d.ingredient] };
      setCounter(c);
      emitActionLog(`Added ${d.ingredient} to cup`);
      return;
    }

    if (d.type === 'steam_pitcher' && steamSlot) {
      if (!c[idx]) {
        c[idx] = { id: steamSlot.id, kind: 'tool', toolType: steamSlot.toolType, contents: [...steamSlot.contents] };
        setCounter(c);
        setSteamSlot(null);
        emitActionLog("Moved pitcher to counter");
        return;
      } else if (c[idx].kind === 'glass' && steamSlot.contents.length > 0) {
        c[idx] = { ...c[idx], contents: [...c[idx].contents, ...steamSlot.contents] };
        setCounter(c);
        setSteamSlot(null);
        emitActionLog("Poured milk into cup");
        return;
      }
    }

    if (d.type === 'counter_item' && d.slotIndex !== idx) {
      const sourceSlot = c[d.slotIndex];
      const targetSlot = c[idx];

      if (sourceSlot && targetSlot && sourceSlot.kind === 'tool' && targetSlot.kind === 'glass' && sourceSlot.contents.length > 0) {
        c[idx] = { ...targetSlot, contents: [...targetSlot.contents, ...sourceSlot.contents] };
        c[d.slotIndex] = null;
        setCounter(c);
        emitActionLog("Poured contents into glass");
        return;
      }

      if (sourceSlot && !targetSlot) {
        c[idx] = sourceSlot;
        c[d.slotIndex] = null;
        setCounter(c);
        emitActionLog("Rearranged counter");
        return;
      }
    }
  };

  /* ── DROP: Counter glass → Serve Tray ── */
  const onDropFinish = (e) => {
    const d = getData(e);
    if (!d || d.type !== 'counter_item') return;
    const slot = counter[d.slotIndex];
    if (!slot || slot.kind !== 'glass' || slot.contents.length === 0) return;

    const drinkName = evaluateDrink(slot.contents);
    setFinished([
      ...finished,
      {
        id: nextId(),
        glassType: slot.glassType,
        contents: [...slot.contents],
        drinkName: drinkName || 'Mystery Brew',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    const c = [...counter];
    c[d.slotIndex] = null;
    setCounter(c);
    emitActionLog(`${drinkName || 'Mystery Brew'}!`, 'success', '[SERVE]');
  };

  /* ── DROP: Trash ── */
  const onDropTrash = (e) => {
    const d = getData(e);
    if (!d || d.type !== 'counter_item') return;
    const c = [...counter];
    c[d.slotIndex] = null;
    setCounter(c);
    emitActionLog(`Trashed item`);
  };

  /* ── Brew & Steam ── */
  const brewEspresso = () => {
    if (!isConnected) return;
    if (!machineSlot || machineSlot.shots >= 2) return;
    if (machineSlot.state === 'grinding' || machineSlot.state === 'brewing') return;
    
    // Prevent UI action if the physical machine is overheated
    if (telemetry?.temperature > 115 || telemetry?.state?.includes('Overheat')) return;

    if (connectionRef.current && isConnected) {
        connectionRef.current.invoke("TriggerMachineAction", "Brew").catch(err => console.error(err));
    }

    setMachineSlot(prev => ({ ...prev, state: 'grinding' }));
    setTimeout(() => {
      setMachineSlot(prev => ({ ...prev, state: 'brewing' }));
      setTimeout(() => {
        setMachineSlot(prev => ({ ...prev, state: 'ready', shots: prev.shots + 1 }));
      }, 2000);
    }, 1000);
  };

  const steamMilk = () => {
    if (!isConnected) return;
    if (!steamSlot || steamSlot.state === 'steaming' || !steamSlot.contents.includes('milk')) return;
    
    // Prevent UI action if the physical machine is overheated
    if (telemetry?.temperature > 115 || telemetry?.state?.includes('Overheat')) return;

    if (connectionRef.current && isConnected) {
        connectionRef.current.invoke("TriggerMachineAction", "Steam").catch(err => console.error(err));
    }

    setSteamSlot(prev => ({ ...prev, state: 'steaming' }));
    setTimeout(() => {
      setSteamSlot(prev => {
        const newContents = prev.contents.map(c => c === 'milk' ? 'steamed_milk' : c);
        return { ...prev, state: 'ready', contents: newContents };
      });
    }, 2500);
  };

  const clearSlot = (idx) => { const c = [...counter]; c[idx] = null; setCounter(c); };
  const clearMachine = () => setMachineSlot(null);
  const clearSteam = () => setSteamSlot(null);
  const resetAll = () => { setMachineSlot(null); setSteamSlot(null); setCounter([null, null, null]); };

  const activeDrink = (() => {
    for (const slot of counter) {
      if (slot && slot.kind === 'glass' && slot.contents.length > 0) {
        return evaluateDrink(slot.contents);
      }
    }
    return null;
  })();

  const isOverheated = telemetry?.temperature > 115 || telemetry?.state?.includes('Overheat');

  return (
    <div className="barista-container">
      {/* Header */}
      <div className="barista-header">
        <h1>Barista Sandbox</h1>
        <div className="header-actions">
          <label className="stats-toggle-label">
            <div className={`stats-toggle-switch ${statsForNerds ? 'active' : ''}`}>
              <div className="stats-toggle-knob"></div>
            </div>
            <input 
              type="checkbox" 
              className="hidden-checkbox" 
              checked={statsForNerds} 
              onChange={(e) => setStatsForNerds(e.target.checked)} 
            />
            Stats for Nerds
          </label>
          <button className="nerd-btn" onClick={() => setShowNerdPopup(true)}>🤓 Backend Nerd</button>
          <button className="reset-all-btn" onClick={resetAll}>Reset Kitchen</button>
        </div>
      </div>

      <div className={`kitchen-scene ${statsForNerds ? 'sidebar-open' : ''}`}>
        
        <div className="kitchen-main-content">
        {/* ═══ WALL & SHELVES (Top Half) ═══ */}
        <div className="wall-section">
          <div className="shelf shelf-ingredients">
            <div className="shelf-group">
              <span className="shelf-label">Glasses</span>
              {SERVING_GLASSES.map(g => (
                <div key={g.id} className="shelf-item" draggable
                  onDragStart={e => dStart(e, { type: 'cupboard_glass', glassType: g.id })}>
                  <img src={getServingGlassImg(g.id, [])} alt={g.label} className="shelf-img" />
                  <span className="item-label">{g.label}</span>
                </div>
              ))}
            </div>

            <div className="shelf-group">
              <span className="shelf-label">Ingredients</span>
              {INGREDIENTS.map(ing => (
                <div key={ing.id} className="shelf-item" draggable
                  onDragStart={e => dStart(e, { type: 'ingredient', ingredient: ing.id })}>
                  <img src={ing.img} alt={ing.label} className="shelf-img" />
                  <span className="item-label">{ing.label}</span>
                </div>
              ))}
            </div>
            
            <div className="shelf-group">
              <span className="shelf-label">Tools</span>
              {CROCKERY_TOOLS.map(tool => (
                <div key={tool.id} className="shelf-item tool-item" 
                  draggable
                  onDragStart={e => dStart(e, { type: 'shelf_tool', toolType: tool.id })}
                  onClick={() => grabTool(tool.id)} title={`Drag or Click: ${tool.label}`}>
                  <img src={getToolImg(tool.id, false)} alt={tool.label} className="shelf-img small-img" />
                  <span className="item-label">{tool.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ═══ COUNTERTOP (Bottom Half) ═══ */}
        <div className="countertop-section">
          
          {/* Machine Zone */}
          <div className="machine-zone">
            <div className="machine-wrapper">
              <img src="/assets/espresso_machine.png" alt="Espresso Machine" className="machine-main-img" />

              {/* Steam Wand (Left) */}
              <div className="steam-wand-zone">
                <button className={`steam-btn ${steamSlot?.state === 'steaming' ? 'steaming' : ''} ${isOverheated || !isConnected ? 'error-btn' : ''}`}
                  onClick={steamMilk}
                  disabled={!isConnected || isOverheated || !steamSlot || steamSlot.state === 'steaming' || !steamSlot.contents.includes('milk')}>
                  {!isConnected ? 'OFFLINE' : isOverheated ? 'LOCKED' : steamSlot?.state === 'steaming' ? '♨️ Steaming...' : 'Steam Milk'}
                </button>
                <div className={`steam-tray ${!steamSlot ? 'empty-tray' : ''}`}
                  onDrop={onDropSteamWand} onDragOver={dOver} onDragLeave={dLeave}>
                  {steamSlot && (
                    <div className={`tray-glass ${steamSlot.state === 'steaming' ? 'shake' : ''}`}
                      draggable={steamSlot.state === 'ready'}
                      onDragStart={e => { if (steamSlot.state === 'ready') dStart(e, { type: 'steam_pitcher' }); }}>
                      <img src={getToolImg(steamSlot.toolType, steamSlot.contents.length > 0)} alt="Pitcher" className="tray-img" />
                      {steamSlot.contents.includes('steamed_milk') && <span className="shot-badge">Steamed</span>}
                      {steamSlot.contents.includes('milk') && !steamSlot.contents.includes('steamed_milk') && <span className="shot-badge">Milk</span>}
                    </div>
                  )}
                </div>
                {steamSlot && <button className="clear-machine-btn steam-clear" onClick={clearSteam}>✕</button>}
              </div>

              {/* Espresso Brew (Right/Center) */}
              <button className={`brew-btn ${machineSlot?.state === 'grinding' ? 'grinding' : ''} ${isOverheated || !isConnected ? 'error-btn' : ''}`}
                onClick={brewEspresso}
                disabled={!isConnected || isOverheated || !machineSlot || machineSlot.state === 'grinding' || machineSlot.state === 'brewing' || machineSlot.shots >= 2}>
                {!isConnected ? 'OFFLINE'
                  : isOverheated ? 'OVERHEATED'
                  : machineSlot?.state === 'grinding' ? '⚙️ Grinding...'
                  : machineSlot?.state === 'brewing' ? '☕ Brewing...'
                  : machineSlot?.shots >= 2 ? 'Max Shots'
                  : 'Brew Shot'}
              </button>

              <div className={`drip-tray ${!machineSlot ? 'empty-tray' : ''}`}
                onDrop={onDropMachine} onDragOver={dOver} onDragLeave={dLeave}>
                {machineSlot && (
                  <div className={`tray-glass ${machineSlot.state === 'grinding' ? 'shake' : ''}`}
                    draggable={machineSlot.state === 'ready'}
                    onDragStart={e => { if (machineSlot.state === 'ready') dStart(e, { type: 'machine_glass' }); }}>
                    <img src={getToolImg(machineSlot.toolType, machineSlot.shots > 0)} alt="Shot glass" className="tray-img" />
                    {machineSlot.shots > 0 && <span className="shot-badge">{machineSlot.shots}x</span>}
                  </div>
                )}
              </div>
              {machineSlot && <button className="clear-machine-btn" onClick={clearMachine}>✕ Remove</button>}
            </div>
          </div>

          {/* Workspace Zone (3 slots) */}
          <div className="workspace-zone">
            {counter.map((slot, i) => (
              <div key={i} className={`workspace-slot ${slot ? 'occupied' : ''}`}
                onDrop={e => onDropCounterSlot(e, i)} onDragOver={dOver} onDragLeave={dLeave}>
                
                {slot && (
                  <div className="slot-item-wrapper"
                    draggable
                    onDragStart={e => dStart(e, { type: 'counter_item', slotIndex: i, kind: slot.kind, toolType: slot.toolType })}>
                    
                    <div className="slot-drink-label-container">
                      {slot.kind === 'glass' && slot.contents.length > 0 && (
                        <div className="slot-drink-label">{evaluateDrink(slot.contents)}</div>
                      )}
                    </div>

                    <img src={getSlotImg(slot)} alt="item" className="slot-item-img" />
                    
                    <div className="slot-tags">
                      {slot.contents.length > 0
                        ? slot.contents.map((c, j) => <span key={j} className={`ingredient-tag tag-${c}`}>{c}</span>)
                        : <span className="empty-label">Empty</span>
                      }
                    </div>
                    
                    <button className="slot-clear-btn" onClick={() => clearSlot(i)}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Serve & Trash Zone (Right Panel) */}
          <div className="right-panel">
            <div className="serve-zone">
              <div className="serving-tray" onDrop={onDropFinish} onDragOver={dOver} onDragLeave={dLeave}>
                <span className="tray-label">Serving Tray</span>
                <span className="tray-sub">Drop finished drinks here</span>
              </div>

              {finished.length > 0 && (
                <div className="finished-list-overlay">
                  <div className="finished-header" onClick={() => setShowServedDrinks(!showServedDrinks)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Served Drinks</h3>
                    <span>{showServedDrinks ? '▲' : '▼'}</span>
                  </div>
                  {showServedDrinks && finished.map((drink) => (
                    <div key={drink.id} className="finished-item">
                      <img src={getServingGlassImg(drink.glassType, drink.contents)} alt={drink.drinkName} className="finished-img" />
                      <div className="finished-info">
                        <span className="finished-name">{drink.drinkName}</span>
                        <span className="finished-time">{drink.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="trash-zone"
              onDragOver={e => e.preventDefault()}
              onDrop={onDropTrash}
            >
              🗑️ Trash (Drop to empty)
            </div>
          </div>
        </div>
        </div>
        
        {/* Telemetry Sidebar */}
        <div className={`telemetry-sidebar ${statsForNerds ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>System Telemetry</h3>
            <button className="close-sidebar-btn" onClick={() => setStatsForNerds(false)}>×</button>
          </div>
          
          <div className="telemetry-section">
            <h4>Machine State</h4>
            <div className="telemetry-grid">
              <div className={`telemetry-item ${telemetry?.temperature > 110 ? 'danger' : ''}`}>
                <span>Boiler Temp</span>
                <strong>{telemetry?.temperature || 22}°C</strong>
              </div>
              <div className="telemetry-item">
                <span>Pump Pressure</span>
                <strong>{telemetry?.pressure || 0} bar</strong>
              </div>
              <div className="telemetry-item">
                <span>Status</span>
                <strong>{telemetry?.state || 'Idle'}</strong>
              </div>
            </div>
          </div>

          <div className="telemetry-section">
            <h4>Event Logs</h4>
            <div className="log-output" ref={logOutputRef}>
              {eventLogs.map(log => (
                <div key={log.id} className={`log-line ${log.type === 'error' ? 'error' : log.type === 'success' ? 'success' : ''}`}>
                  {log.text}
                </div>
              ))}
              {telemetry?.temperature > 110 && <div className="log-line error">[ALARM] CRITICAL OVERHEAT!</div>}
              {telemetry?.state === 'Brewing' && <div className="log-line">[OP] Extracting espresso...</div>}
            </div>
          </div>
        </div>

      </div>

      {/* Nerd Popup */}
      {showNerdPopup && (
        <div className="nerd-modal-overlay" onClick={() => setShowNerdPopup(false)}>
          <div className="nerd-modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-nerd-btn" onClick={() => setShowNerdPopup(false)}>×</button>
            <h2>🤓 The "Unnecessarily Crazy" Backend</h2>
            <p className="nerd-intro">
              This simple coffee simulator is actually powered by a completely over-engineered 
              <strong> .NET 10 Microservices Architecture</strong> using Clean Architecture principles.
            </p>
            
            <div className="nerd-tech-stack">
              <div className="tech-item">
                <span className="tech-icon">🌐</span>
                <div>
                  <strong>SignalR (WebSockets)</strong>
                  <p>Provides a real-time, bi-directional connection between this React frontend and the .NET API.</p>
                </div>
              </div>
              <div className="tech-item">
                <span className="tech-icon">🚌</span>
                <div>
                  <strong>MassTransit (Message Broker)</strong>
                  <p>When you click "Brew", the API doesn't just return a response. It publishes a <code>MachineActivatedEvent</code> to an event bus, completely decoupling the web layer from the processing layer.</p>
                </div>
              </div>
              <div className="tech-item">
                <span className="tech-icon">⚙️</span>
                <div>
                  <strong>IoT Telemetry Simulation</strong>
                  <p>A background Consumer microservice picks up the event, acts like physical machine hardware, and continuously streams <code>TelemetryUpdatedEvent</code> messages back through the bus and out via SignalR to the HUD.</p>
                </div>
              </div>
            </div>
            
            <div className="nerd-flow">
              <code>React UI ➡️ SignalR ➡️ ASP.NET API ➡️ MassTransit Bus ➡️ Consumer Service (Calculates Heat/Pressure) ➡️ MassTransit ➡️ SignalR ➡️ React HUD</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
