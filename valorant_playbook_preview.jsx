import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  BookOpen,
  Network,
  Layers,
  Settings,
  Upload,
  Download,
  Search,
  Link as LinkIcon,
  Shield,
  Swords,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Copy,
  Trash2,
  Plus,
  Image as ImageIcon,
  BookMarked,
  BarChart3,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Reference images (optional)
// -----------------------------------------------------------------------------
const REF_SHEET_IMG = "/refs/playbook-sheet.png";
const REF_DASHBOARD_IMG = "/refs/teamhq-dashboard.png";

// -----------------------------------------------------------------------------
// Core model
// -----------------------------------------------------------------------------
const MAPS = ["Haven", "Ascent", "Abyss", "Sunset", "Corrode", "Bind", "Lotus", "Pearl", "Split"];
const SIDES = ["Attack", "Defense"];

// spreadsheet-like sections
const MAPS_SHEET = ["Haven", "Ascent", "Abyss", "Sunset", "Corrode", "Bind", "Lotus"];
const MAPS_COMPS = ["Haven", "Pearl", "Abyss", "Sunset", "Corrode", "Bind", "Split"];

const STORAGE_KEY = "valorant_playbook_v3";

const AGENTS = [
  "Astra",
  "Breach",
  "Brimstone",
  "Chamber",
  "Clove",
  "Cypher",
  "Deadlock",
  "Fade",
  "Gekko",
  "Harbor",
  "Iso",
  "Jett",
  "KAY/O",
  "Killjoy",
  "Neon",
  "Omen",
  "Phoenix",
  "Raze",
  "Reyna",
  "Sage",
  "Skye",
  "Sova",
  "Viper",
  "Vyse",
  "Waylay",
  "Yoru",
  "Tejo",
];

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Seed: Trigger Words (dictionary)
// -----------------------------------------------------------------------------
function seedDictionary() {
  const raw = [
    ["Glue", "Stick with me as a pair"],
    ["Up Numbers", "(Then call XvX situation) Up numbers play for trades/crossfires"],
    ["Diamondlegs", "Hold the setup"],
    ["Gambit", "Passive default"],
    ["React", "When one side is getting pressured, the other side needs a reaction"],
    ["Smeag", "When we get the pick - we want to go instantly on that site"],
    ["Match [Location]", "Match what utility they are using"],
    ["Up", "Use less utility than what they use to take space with"],
    ["Trap [Location]", "Set reclear: after they use utility, we use our trap play"],
    ["Onion (Branching)", "Adding utility onto a play off of others"],
    ["Anti", "(Who’s anti, “I’m anti”) Playing anti-flash"],
    ["Chicken (Name it)", "(Who’s Chicken, “I’m Chicken”) Who is the arrow breaker"],
    ["Shark / Orgy", "Group as 5 / everyone no matter what"],
    ["Flood", "Get into site to help teammates"],
    ["Spots", "Rundown of postplant (WHAT ARE YOU WATCHING)"],
    ["Turtle", "Anchor sites - passive - double up etc."],
    ["Freeze", "Get a pick or two → play the 5v3: hold, jiggle for info, wait for their react"],
    ["Reset", "Fall back to more passive positions"],
    ["Off me", "Peek off the player’s contact"],
    ["“Name” Crossfire", "Post plant or late round defense situation - someone call it"],
    ["Contact", "Walk contact in"],
    ["Entry", "Entry calls entry and 2nd MUST call 2nd on execute/retake (limited util user)"],
    ["Spacing", "Guy behind calls to wait — he’s too far behind"],
    ["Blitz", "Fast retake (max 1 set of util)"],
    ["Pressure [Location]", "Use util to pressure/bait reaction (DON’T actually take control)"],
    ["Update", "Give an update on what you’ve seen/heard"],
    ["WIN-CON", "Players say win condition: “Our win-con is to hold Door and Halls”"],
    ["Snail", "One player calls snail; holds smoke run-through as team scales"],
    ["Pineapple", "Wait for player to make a play"],
    ["Yo ADAPT", "If something is not working, fix it"],
  ];

  return {
    entries: raw.map(([term, meaning]) => ({
      id: uid(),
      term,
      meaning,
      example: "",
      tags: [],
    })),
  };
}

// -----------------------------------------------------------------------------
// Seed: Playbook graph
// -----------------------------------------------------------------------------
function seedGraph(map, side) {
  const base = { nodes: [], edges: [], plays: [] };

  const addPlay = (p) => base.plays.push({ id: uid(), ...p });

  const addNode = (type, label, detail, x, y, extra = {}) => {
    const id = uid();
    base.nodes.push({
      id,
      type: "playNode",
      position: { x, y },
      data: {
        kind: type,
        label,
        detail,
        tags: extra.tags || [],
        tempo: extra.tempo || "MED",
        triggers: extra.triggers || [],
        image: extra.image || "",
      },
    });
    return id;
  };

  const link = (a, b, label = "") => {
    base.edges.push({
      id: uid(),
      source: a,
      target: b,
      label,
      animated: false,
      style: { strokeWidth: 2 },
    });
  };

  const title = (t) =>
    addNode(
      "note",
      t,
      "Use this as the one-sentence plan. If comms get messy, snap back to this.",
      40,
      40,
      { tags: ["one-call"] }
    );

  const branch = ({ startX, startY, start, ifCond, thenDo, elseDo, labels = {} }) => {
    const a = addNode("start", start, "", startX, startY, labels.start || {});
    const c = addNode(
      "condition",
      ifCond,
      "Trigger = something you can SEE/HEAR, not a vibe.",
      startX + 260,
      startY,
      labels.cond || {}
    );
    const t = addNode("action", thenDo, "", startX + 520, startY - 90, labels.then || {});
    const e = addNode("fallback", elseDo, "Fallbacks keep you from freezing.", startX + 520, startY + 90, labels.else || {});
    link(a, c);
    link(c, t, "IF");
    link(c, e, "ELSE");
    return { a, c, t, e };
  };

  if (map === "Lotus" && side === "Attack") {
    title("Lotus Attack: take A space early, punish rotations, then hit with numbers");

    addPlay({
      category: "Start",
      name: "Hard B hit → if stalled, speed C",
      tempo: "FAST",
      trigger: "B fight stalls / utility traded",
      steps: [
        "Hard commit B with first wave utility.",
        "If entry is denied or you lose the fight timing: instantly pivot C (no mid linger).",
        "Keep lurk smoke to cut rotate line on the pivot.",
      ],
      checklist: ["Call once", "Hit as 5", "Pivot timing < 6s"],
    });

    branch({
      startX: 40,
      startY: 140,
      start: "R1: Hard B hit",
      ifCond: "Stalled at B / trade tempo lost",
      thenDo: "Snap pivot to C (speed)",
      elseDo: "Finish B: plant, post",
      labels: { start: { tempo: "FAST", tags: ["round1"] }, then: { tempo: "FAST", tags: ["pivot"] } },
    });

    return base;
  }

  title(`${map} ${side}: starter skeleton — replace with your real calls`);

  addPlay({
    category: "Starter",
    name: "Create your first Default",
    tempo: "SLOW",
    trigger: "N/A",
    steps: ["Who takes what space", "What info do we get", "What is the hit timing"],
    checklist: ["One call", "Roles", "Fallback"],
  });

  addNode(
    "start",
    "Start Plan",
    "Pick one starter, then define the trigger that flips you to the next box.",
    40,
    140,
    { tags: ["starter"], tempo: "MED" }
  );

  addNode(
    "fallback",
    "Universal fallback",
    "If you’re unsure: stop feeding, take space together, and re-call a simple hit.",
    40,
    320,
    { tempo: "SLOW", tags: ["fallback"] }
  );

  return base;
}

// -----------------------------------------------------------------------------
// Seed: starts sheet
// -----------------------------------------------------------------------------
function seedStartsFromScreenshot() {
  const blank = () => ({ Round1: "", Round2: "", Round3: "", Round4: "", Ult: "" });

  const Defense = {
    Haven: blank(),
    Ascent: {
      Round1: "2-2-1 start into 3-1-1",
      Round2: "4-0-1 start, fight off Cat",
      Round3: "2-0-3 setup",
      Round4: "B main fight (2-0-3) + Sova Cat",
      Ult: "Omen ult bottom mid",
    },
    Abyss: {
      Round1: "A-main fight",
      Round2: "1-4-0 trap into flood",
      Round3: "B-main push with only Waylay, Yoru",
      Round4: "Stairmaster 3000 (on dart break flash)",
      Ult: "Waylay ult middle",
    },
    Sunset: {
      Round1: "2-1-2 get orb A",
      Round2: "3-0-2 deny A-rush; Omen+Sage get orb B",
      Round3: "1-1-3 into mid refight",
      Round4: "Mask Cypher A",
      Ult: "Have not decided yet",
    },
    Corrode: {
      Round1: "WATCH NRG OR MIBR VOD",
      Round2: "WATCH NRG OR MIBR VOD",
      Round3: "WATCH NRG OR MIBR VOD",
      Round4: "WATCH NRG OR MIBR VOD",
      Ult: "WATCH NRG OR MIBR VOD",
    },
    Bind: {
      Round1: "3-2 Viper hold long; TP hookah on Clove contact",
      Round2: "Showers fight with ult through TP",
      Round3: "DRX long kill",
      Round4: "Showers crunch",
      Ult: "Viper ult short",
    },
    Lotus: {
      Round1: "C hold into B rotate (3-0-2)",
      Round2: "Full control orb default",
      Round3: "B trap 1-3-1",
      Round4: "A control",
      Ult: "Sova ult",
    },
  };

  const Attack = {
    Haven: blank(),
    Ascent: {
      Round1: "5 A main rush",
      Round2: "4 hold outside A; KJ walk up B (Sova mid pressure from top middle)",
      Round3: "2B - 3A start",
      Round4: "3B - 2A start",
      Ult: "Yoru fake ult",
    },
    Abyss: {
      Round1: "Mid walk to B-split",
      Round2: "B hit",
      Round3: "Orb default into mid-reclear",
      Round4: "A main conditioning then 5-man A hit",
      Ult: "Astra wall middle gimmick",
    },
    Sunset: {
      Round1: "B pop with site wall → go market",
      Round2: "Market split",
      Round3: "Mid control spread",
      Round4: "Market pump",
      Ult: "Sova ult A hit",
    },
    Corrode: {
      Round1: "WATCH NRG OR MIBR VOD",
      Round2: "WATCH NRG OR MIBR VOD",
      Round3: "WATCH NRG OR MIBR VOD",
      Round4: "WATCH NRG OR MIBR VOD",
      Ult: "WATCH NRG OR MIBR VOD",
    },
    Bind: {
      Round1: "Hookah pop",
      Round2: "A hit scaling front site",
      Round3: "Fnatic default",
      Round4: "Tenz play",
      Ult: "Waylay ult B",
    },
    Lotus: {
      Round1: "Hard B hit; if stalled, speed into C",
      Round2: "Take A; fake Tree into B split",
      Round3: "Take A control; walk through Tree into hit",
      Round4: "C control → C contact with lurk smoke",
      Ult: "Omen ult spawn",
    },
  };

  return { Attack, Defense };
}

function seedRosterForTeam(teamPlayers) {
  const ratings = {};
  const prefs = {};
  teamPlayers.forEach((p) => {
    ratings[p] = {};
    prefs[p] = {};
    MAPS.forEach((m) => {
      ratings[p][m] = "";
      prefs[p][m] = [];
    });
  });

  // optional seeds for overlapping names
  const seedRatings = {
    Bishop: { Haven: 4, Ascent: 9, Abyss: 8, Sunset: 4, Corrode: 6, Bind: 5, Lotus: 6 },
    Gav: { Haven: 7, Ascent: 8, Abyss: 7, Sunset: 5, Corrode: 6, Bind: 6, Lotus: 6 },
    Wes: { Haven: 8, Ascent: 6, Abyss: 6, Sunset: 7, Corrode: 7, Bind: 5, Lotus: 9 },
  };
  Object.keys(seedRatings).forEach((player) => {
    if (!ratings[player]) return;
    Object.entries(seedRatings[player]).forEach(([m, v]) => (ratings[player][m] = v));
  });

  const comps = {};
  MAPS.forEach((m) => (comps[m] = {}));

  // a few comp seeds
  const seedComps = {
    Haven: { Bishop: "Omen", Gav: "Neon", Wes: "Sova", Jake: "Killjoy", Chris: "Viper" },
    Pearl: { Bishop: "Fade", Gav: "Neon", Wes: "Fade", Jake: "Vyse", Chris: "Astra" },
    Abyss: { Bishop: "Deadlock", Gav: "Yoru", Wes: "Sova", Jake: "Omen", Chris: "Astra" },
    Sunset: { Bishop: "Sage", Gav: "Neon", Wes: "Fade", Jake: "Chamber", Chris: "Omen" },
    Corrode: { Bishop: "KAY/O", Gav: "Waylay", Wes: "Sova", Jake: "Deadlock", Chris: "Omen" },
    Bind: { Bishop: "Skye", Gav: "Chamber", Wes: "Raze", Jake: "Viper", Chris: "Brimstone" },
    Split: { Bishop: "Skye", Gav: "Waylay", Wes: "Raze", Jake: "Viper", Chris: "Astra" },
  };
  Object.keys(seedComps).forEach((m) => {
    comps[m] = comps[m] || {};
    Object.entries(seedComps[m]).forEach(([player, agent]) => {
      if (teamPlayers.includes(player)) comps[m][player] = agent;
    });
  });

  return { ratings, comps, prefs };
}

function seedInitialState() {
  const teams = [{ id: "team_main", name: "Main Roster", players: ["Bishop", "Gav", "Wes", "Jake", "Chris"] }];

  const playbooks = {};
  const roster = {};
  const starts = {};

  teams.forEach((t) => {
    playbooks[t.id] = {};
    MAPS.forEach((m) => {
      playbooks[t.id][m] = {};
      SIDES.forEach((s) => (playbooks[t.id][m][s] = seedGraph(m, s)));
    });

    roster[t.id] = seedRosterForTeam(t.players);
    starts[t.id] = seedStartsFromScreenshot();
  });

  return {
    version: 3,
    settings: { activeTeamId: teams[0].id, quickGlance: true, showReferencePanel: true, embedUrl: "" },
    teams,
    playbooks,
    dictionary: seedDictionary(),
    roster,
    starts,
  };
}

function normalizeState(saved) {
  if (!saved) return seedInitialState();
  const st = structuredClone(saved);

  st.version = st.version || 1;
  st.settings = st.settings || {};
  if (typeof st.settings.quickGlance !== "boolean") st.settings.quickGlance = true;
  if (typeof st.settings.showReferencePanel !== "boolean") st.settings.showReferencePanel = true;
  if (typeof st.settings.embedUrl !== "string") st.settings.embedUrl = "";

  st.teams = st.teams || [];
  st.playbooks = st.playbooks || {};

  if (!st.dictionary || !Array.isArray(st.dictionary.entries)) st.dictionary = seedDictionary();

  st.roster = st.roster || {};
  st.starts = st.starts || {};

  st.teams.forEach((t) => {
    st.playbooks[t.id] = st.playbooks[t.id] || {};
    MAPS.forEach((m) => {
      st.playbooks[t.id][m] = st.playbooks[t.id][m] || {};
      SIDES.forEach((s) => {
        if (!st.playbooks[t.id][m][s]) st.playbooks[t.id][m][s] = seedGraph(m, s);
      });
    });

    if (!st.roster[t.id]) st.roster[t.id] = seedRosterForTeam(t.players || []);
    if (!st.starts[t.id]) st.starts[t.id] = seedStartsFromScreenshot();

    const teamPlayers = t.players || [];
    const r = st.roster[t.id];
    r.ratings = r.ratings || {};
    r.prefs = r.prefs || {};
    teamPlayers.forEach((p) => {
      if (!r.ratings[p]) r.ratings[p] = {};
      if (!r.prefs[p]) r.prefs[p] = {};
      MAPS.forEach((m) => {
        if (r.ratings[p][m] === undefined) r.ratings[p][m] = "";
        if (!Array.isArray(r.prefs[p][m])) r.prefs[p][m] = [];
      });
    });

    r.comps = r.comps || {};
    MAPS.forEach((m) => (r.comps[m] = r.comps[m] || {}));
  });

  st.version = 3;
  return st;
}

// -----------------------------------------------------------------------------
// UI helpers
// -----------------------------------------------------------------------------
function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-700/60 bg-zinc-900/40 px-2 py-0.5 text-xs text-zinc-200">
      {children}
    </span>
  );
}

function IconTab({ active, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition " +
        (active ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-900 hover:text-white")
      }
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function SideChip({ side, active, onClick }) {
  const Icon = side === "Attack" ? Swords : Shield;
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-2 rounded-full px-3 py-1 text-sm transition border " +
        (active ? "border-zinc-500 bg-zinc-800 text-white" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-900")
      }
    >
      <Icon size={14} />
      {side}
    </button>
  );
}

const KIND_STYLE = {
  note: "border-zinc-600 bg-zinc-950",
  start: "border-emerald-500/70 bg-zinc-950",
  condition: "border-amber-500/70 bg-zinc-950",
  action: "border-sky-500/70 bg-zinc-950",
  fallback: "border-rose-500/70 bg-zinc-950",
};

function PlayNode({ data, selected }) {
  const { kind, label, detail, tags, tempo, image } = data;
  return (
    <div
      className={
        "min-w-[220px] max-w-[280px] rounded-xl border p-3 shadow-sm " +
        (KIND_STYLE[kind] || KIND_STYLE.note) +
        (selected ? " ring-2 ring-white/30" : "")
      }
    >
      {image ? (
        <div className="mb-2 overflow-hidden rounded-lg border border-zinc-800">
          <img src={image} alt="node" className="w-full h-28 object-cover" />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-zinc-100 leading-snug">{label}</div>
        <Pill>{tempo}</Pill>
      </div>
      {detail ? <div className="mt-2 text-xs text-zinc-300 leading-snug line-clamp-3">{detail}</div> : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {(tags || []).slice(0, 4).map((t) => (
          <Pill key={t}>{t}</Pill>
        ))}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-wide text-zinc-400">{kind}</div>
    </div>
  );
}

const nodeTypes = { playNode: PlayNode };

// -----------------------------------------------------------------------------
// Flow editor (node image upload)
// -----------------------------------------------------------------------------
function FlowEditor({ state, setState, teamId, map, side, quickGlance }) {
  const { fitView } = useReactFlow();

  const graph = state.playbooks?.[teamId]?.[map]?.[side];

  const [nodes, setNodes] = useState(graph?.nodes || []);
  const [edges, setEdges] = useState(graph?.edges || []);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setNodes(graph?.nodes || []);
    setEdges(graph?.edges || []);
    setSelectedNodeId(null);
    setSearch("");
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, map, side]);

  const selected = useMemo(() => nodes.find((n) => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  const filteredPlays = useMemo(() => {
    const plays = graph?.plays || [];
    if (!search.trim()) return plays;
    const q = search.toLowerCase();
    return plays.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.trigger || "").toLowerCase().includes(q)
    );
  }, [graph?.plays, search]);

  const onNodesChange = (changes) => setNodes((nds) => applyNodeChanges(changes, nds));
  const onEdgesChange = (changes) => setEdges((eds) => applyEdgeChanges(changes, eds));
  const onConnect = (params) => setEdges((eds) => addEdge({ ...params, style: { strokeWidth: 2 } }, eds));

  const persist = (nextNodes, nextEdges, nextPlays) => {
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.playbooks[teamId][map][side].nodes = nextNodes;
      copy.playbooks[teamId][map][side].edges = nextEdges;
      if (nextPlays) copy.playbooks[teamId][map][side].plays = nextPlays;
      return copy;
    });
  };

  useEffect(() => {
    const t = setTimeout(() => persist(nodes, edges, null), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const addBox = (kind) => {
    const n = {
      id: uid(),
      type: "playNode",
      position: { x: 80, y: 80 },
      data: {
        kind,
        label: `${kind.toUpperCase()}: rename me`,
        detail: "Write the trigger, the win condition, and the fallback.",
        tags: ["new"],
        tempo: "MED",
        triggers: [],
        image: "",
      },
    };
    const nextNodes = [...nodes, n];
    setNodes(nextNodes);
    persist(nextNodes, edges, null);
    setSelectedNodeId(n.id);
    setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 50);
  };

  const deleteSelected = () => {
    if (!selectedNodeId) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const nextEdges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
    setNodes(nextNodes);
    setEdges(nextEdges);
    persist(nextNodes, nextEdges, null);
    setSelectedNodeId(null);
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    const nextNodes = nodes.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n));
    setNodes(nextNodes);
    persist(nextNodes, edges, null);
  };

  const addPlayFromSelected = () => {
    if (!selected) return;
    const p = {
      id: uid(),
      category: selected.data.kind === "start" ? "Start" : "Option",
      name: selected.data.label,
      tempo: selected.data.tempo || "MED",
      trigger: selected.data.kind === "condition" ? selected.data.label : "Define trigger",
      steps: ["Step 1", "Step 2", "Step 3"],
      checklist: ["Roles", "Tempo", "Fallback"],
    };
    const nextPlays = [p, ...(graph?.plays || [])];
    persist(nodes, edges, nextPlays);
  };

  const uploadNodeImage = (file) => {
    if (!selected || !file) return;
    const reader = new FileReader();
    reader.onload = () => updateSelected({ image: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 h-[calc(100vh-160px)]">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="flex items-center gap-2">
            <Network size={18} className="text-zinc-200" />
            <div className="text-sm font-semibold text-white">Flowchart</div>
            <Pill>{map}</Pill>
            <Pill>{side}</Pill>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={() => fitView({ padding: 0.2, duration: 250 })}
            >
              Fit
            </button>
            <button
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={() => addBox("condition")}
            >
              <span className="inline-flex items-center gap-1">
                <Plus size={14} />
                Condition
              </span>
            </button>
            <button
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={() => addBox("action")}
            >
              <span className="inline-flex items-center gap-1">
                <Plus size={14} />
                Action
              </span>
            </button>
            <button
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={deleteSelected}
              title="Delete selected"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
            <Panel
              position="top-left"
              className="m-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-200"
            >
              <div className="font-semibold text-white">Quick rules</div>
              <ul className="mt-1 space-y-1 list-disc pl-4 text-zinc-300">
                <li>Every box needs a visible trigger.</li>
                <li>Every plan needs a fallback.</li>
                <li>One call. Then execute.</li>
              </ul>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 overflow-auto">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Right Panel</div>
          <Pill>{quickGlance ? "Quick" : "Deep"}</Pill>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Selected box</div>
          {selected ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Pill>{selected.data.kind}</Pill>
                <Pill>{selected.data.tempo}</Pill>
              </div>

              <label className="block">
                <div className="text-xs text-zinc-300">Label</div>
                <input
                  value={selected.data.label}
                  onChange={(e) => updateSelected({ label: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="block">
                <div className="text-xs text-zinc-300">Detail</div>
                <textarea
                  value={selected.data.detail}
                  onChange={(e) => updateSelected({ detail: e.target.value })}
                  rows={quickGlance ? 3 : 6}
                  className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <div className="text-xs text-zinc-300">Tempo</div>
                  <select
                    value={selected.data.tempo}
                    onChange={(e) => updateSelected({ tempo: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
                  >
                    <option>FAST</option>
                    <option>MED</option>
                    <option>SLOW</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs text-zinc-300">Tags (comma)</div>
                  <input
                    value={(selected.data.tags || []).join(", ")}
                    onChange={(e) =>
                      updateSelected({
                        tags: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white inline-flex items-center gap-2">
                    <ImageIcon size={16} /> Node Image
                  </div>
                  {selected.data.image ? (
                    <button
                      onClick={() => updateSelected({ image: "" })}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                      title="Remove image"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>

                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800">
                  <Upload size={16} />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadNodeImage(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <button
                onClick={addPlayFromSelected}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
              >
                <Copy size={16} />
                Add to Quick Glance list
              </button>
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-300">Click a box to edit.</div>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-zinc-200" />
              <div className="text-sm font-semibold text-white">Plays</div>
              <Pill>{filteredPlays.length}</Pill>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plays"
                className="w-48 rounded-lg border border-zinc-800 bg-zinc-950 pl-8 pr-2 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {filteredPlays.slice(0, quickGlance ? 8 : 50).map((p) => (
              <PlayCard key={p.id} play={p} quick={quickGlance} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayCard({ play, quick }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">{play.category}</div>
            <div className="mt-1 text-sm font-semibold text-white leading-snug">{play.name}</div>
            <div className="mt-1 text-xs text-zinc-300">
              <span className="text-zinc-400">Trigger:</span> {play.trigger}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill>{play.tempo}</Pill>
            {open ? (
              <ChevronDown size={16} className="text-zinc-300" />
            ) : (
              <ChevronRight size={16} className="text-zinc-300" />
            )}
          </div>
        </div>
      </button>

      {!quick && open ? (
        <div className="mt-3 grid grid-cols-1 gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-400">Steps</div>
            <ol className="mt-1 list-decimal pl-5 text-sm text-zinc-200 space-y-1">
              {(play.steps || []).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-400">Checklist</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(play.checklist || []).map((c) => (
                <Pill key={c}>{c}</Pill>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {quick ? <div className="mt-2 text-xs text-zinc-400">Tap for deep read mode.</div> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Trigger Words page
// -----------------------------------------------------------------------------
function TriggerWordsPage({ state, setState }) {
  const [q, setQ] = useState("");

  const entries = state.dictionary?.entries || [];
  const filtered = useMemo(() => {
    if (!q.trim()) return entries;
    const s = q.toLowerCase();
    return entries.filter((e) => e.term.toLowerCase().includes(s) || (e.meaning || "").toLowerCase().includes(s));
  }, [entries, q]);

  const update = (id, patch) => {
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.dictionary.entries = copy.dictionary.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
      return copy;
    });
  };

  const add = () => {
    const term = prompt("Trigger word / call name:");
    if (!term) return;
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.dictionary.entries.unshift({ id: uid(), term: term.trim(), meaning: "", example: "", tags: [] });
      return copy;
    });
  };

  const del = (id) => {
    if (!confirm("Delete trigger word?")) return;
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.dictionary.entries = copy.dictionary.entries.filter((e) => e.id !== id);
      return copy;
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <BookMarked size={18} className="text-zinc-200" />
          <div className="text-sm font-semibold text-white">Trigger Words</div>
        </div>
        <div className="mt-2 text-sm text-zinc-300">Team dictionary. Keep language consistent.</div>

        <div className="mt-3 relative">
          <Search size={14} className="absolute left-2 top-2.5 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search trigger words"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-8 pr-2 py-2 text-sm text-white"
          />
        </div>

        <button
          onClick={add}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
        >
          <Plus size={16} /> Add trigger word
        </button>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-300">
          Rule: triggers should be observable. “STALL B” beats “it feels bad”.
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((e) => (
          <div key={e.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-lg font-semibold text-white">{e.term}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(e.term)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  title="Copy"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => del(e.id)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <label className="block mt-3">
              <div className="text-xs text-zinc-300">Meaning</div>
              <textarea
                value={e.meaning}
                onChange={(ev) => update(e.id, { meaning: ev.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block mt-3">
              <div className="text-xs text-zinc-300">Example (optional)</div>
              <input
                value={e.example || ""}
                onChange={(ev) => update(e.id, { example: ev.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block mt-3">
              <div className="text-xs text-zinc-300">Tags (comma)</div>
              <input
                value={(e.tags || []).join(", ")}
                onChange={(ev) =>
                  update(e.id, {
                    tags: ev.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Roster page
// -----------------------------------------------------------------------------
function RosterPage({ state, setState, teamId }) {
  const team = state.teams.find((t) => t.id === teamId);
  const players = team?.players || [];

  const roster = state.roster?.[teamId];
  const starts = state.starts?.[teamId];

  const setRating = (player, map, value) => {
    const v = value === "" ? "" : Math.max(1, Math.min(10, Number(value)));
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.roster[teamId].ratings[player][map] = value === "" ? "" : v;
      return copy;
    });
  };

  const setComp = (map, player, agent) => {
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.roster[teamId].comps[map][player] = agent;
      return copy;
    });
  };

  const setPrefs = (player, map, csv) => {
    const list = csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.roster[teamId].prefs[player][map] = list;
      return copy;
    });
  };

  const setStart = (side, map, key, text) => {
    setState((prev) => {
      const copy = structuredClone(prev);
      copy.starts[teamId][side][map][key] = text;
      return copy;
    });
  };

  const mapAverages = useMemo(() => {
    const out = {};
    MAPS_SHEET.forEach((m) => {
      const nums = players
        .map((p) => roster?.ratings?.[p]?.[m])
        .filter((x) => x !== "" && x !== undefined && x !== null)
        .map(Number)
        .filter((n) => !Number.isNaN(n));
      out[m] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    });
    return out;
  }, [players, roster]);

  const playerAverage = (p) => {
    const nums = MAPS_SHEET.map((m) => roster?.ratings?.[p]?.[m])
      .filter((x) => x !== "" && x !== undefined && x !== null)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  };

  const RowKeys = ["Round1", "Round2", "Round3", "Round4", "Ult"];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-zinc-200" />
          <div className="text-sm font-semibold text-white">Map Ratings (1–10)</div>
        </div>

        <div className="mt-3 overflow-auto rounded-xl border border-zinc-800">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-zinc-900/40">
              <tr>
                <th className="text-left p-2 border-b border-zinc-800">Player</th>
                {MAPS_SHEET.map((m) => (
                  <th key={m} className="text-left p-2 border-b border-zinc-800">
                    {m}
                  </th>
                ))}
                <th className="text-left p-2 border-b border-zinc-800">Avg</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p} className="border-b border-zinc-900">
                  <td className="p-2 font-semibold">{p}</td>
                  {MAPS_SHEET.map((m) => (
                    <td key={m} className="p-2">
                      <input
                        value={roster?.ratings?.[p]?.[m] ?? ""}
                        onChange={(e) => setRating(p, m, e.target.value)}
                        inputMode="numeric"
                        className="w-16 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-white"
                        placeholder="-"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-zinc-200">{playerAverage(p) ? playerAverage(p).toFixed(1) : "-"}</td>
                </tr>
              ))}

              <tr className="bg-zinc-900/20">
                <td className="p-2 font-semibold text-zinc-200">Avg</td>
                {MAPS_SHEET.map((m) => (
                  <td key={m} className="p-2 text-zinc-200">
                    {mapAverages[m] ? mapAverages[m].toFixed(1) : "-"}
                  </td>
                ))}
                <td className="p-2 text-zinc-200">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MAPS_SHEET.map((m) => {
            const v = mapAverages[m] || 0;
            return (
              <div key={m} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{m}</div>
                  <Pill>{v ? v.toFixed(1) : "-"}</Pill>
                </div>
                <div className="mt-2 h-3 rounded-full border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="h-full bg-zinc-200" style={{ width: `${Math.min(100, (v / 10) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="text-sm font-semibold text-white">Comps (one agent per map/player)</div>
        <div className="mt-3 overflow-auto rounded-xl border border-zinc-800">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-zinc-900/40">
              <tr>
                <th className="text-left p-2 border-b border-zinc-800">Player</th>
                {MAPS_COMPS.map((m) => (
                  <th key={m} className="text-left p-2 border-b border-zinc-800">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p} className="border-b border-zinc-900">
                  <td className="p-2 font-semibold">{p}</td>
                  {MAPS_COMPS.map((m) => (
                    <td key={m} className="p-2">
                      <select
                        value={roster?.comps?.[m]?.[p] || ""}
                        onChange={(e) => setComp(m, p, e.target.value)}
                        className="w-40 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-white"
                      >
                        <option value="">—</option>
                        {AGENTS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="text-sm font-semibold text-white">Agent Preferences (multi)</div>
        <div className="mt-2 text-sm text-zinc-300">Comma-separated agents per map.</div>

        <div className="mt-3 overflow-auto rounded-xl border border-zinc-800">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-zinc-900/40">
              <tr>
                <th className="text-left p-2 border-b border-zinc-800">Player</th>
                {MAPS_SHEET.map((m) => (
                  <th key={m} className="text-left p-2 border-b border-zinc-800">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p} className="border-b border-zinc-900 align-top">
                  <td className="p-2 font-semibold">{p}</td>
                  {MAPS_SHEET.map((m) => {
                    const list = roster?.prefs?.[p]?.[m] || [];
                    return (
                      <td key={m} className="p-2">
                        <input
                          value={list.join(", ")}
                          onChange={(e) => setPrefs(p, m, e.target.value)}
                          className="w-72 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-white"
                          placeholder="e.g., Omen, Astra"
                        />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {list.slice(0, 6).map((a) => (
                            <Pill key={a}>{a}</Pill>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="text-sm font-semibold text-white">Quick Starts Sheet</div>
        <div className="mt-2 text-sm text-zinc-300">Round 1–4 + ult for Attack/Defense.</div>

        <div className="mt-4">
          <div className="text-sm font-semibold text-white">Defense</div>
          <div className="mt-2 overflow-auto rounded-xl border border-zinc-800">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-zinc-900/40">
                <tr>
                  <th className="text-left p-2 border-b border-zinc-800">Row</th>
                  {MAPS_SHEET.map((m) => (
                    <th key={m} className="text-left p-2 border-b border-zinc-800">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["Round1", "Round2", "Round3", "Round4", "Ult"].map((rk) => (
                  <tr key={rk} className="border-b border-zinc-900">
                    <td className="p-2 font-semibold">{rk === "Ult" ? "Ult Play" : rk}</td>
                    {MAPS_SHEET.map((m) => (
                      <td key={m} className="p-2">
                        <input
                          value={starts?.Defense?.[m]?.[rk] || ""}
                          onChange={(e) => setStart("Defense", m, rk, e.target.value)}
                          className="w-72 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-white"
                          placeholder="—"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-white">Attack</div>
          <div className="mt-2 overflow-auto rounded-xl border border-zinc-800">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-zinc-900/40">
                <tr>
                  <th className="text-left p-2 border-b border-zinc-800">Row</th>
                  {MAPS_SHEET.map((m) => (
                    <th key={m} className="text-left p-2 border-b border-zinc-800">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["Round1", "Round2", "Round3", "Round4", "Ult"].map((rk) => (
                  <tr key={rk} className="border-b border-zinc-900">
                    <td className="p-2 font-semibold">{rk === "Ult" ? "Ult Play" : rk}</td>
                    {MAPS_SHEET.map((m) => (
                      <td key={m} className="p-2">
                        <input
                          value={starts?.Attack?.[m]?.[rk] || ""}
                          onChange={(e) => setStart("Attack", m, rk, e.target.value)}
                          className="w-72 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-white"
                          placeholder="—"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// References & Integrations
// -----------------------------------------------------------------------------
function References({ showReferencePanel, setShowReferencePanel }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Playbook Sheet (reference)</div>
          <button
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
            onClick={() => setShowReferencePanel((v) => !v)}
          >
            {showReferencePanel ? (
              <span className="inline-flex items-center gap-1">
                <EyeOff size={14} />
                Hide panel
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Eye size={14} />
                Show panel
              </span>
            )}
          </button>
        </div>
        {showReferencePanel ? (
          <div className="mt-3 overflow-auto rounded-xl border border-zinc-800">
            <img src={REF_SHEET_IMG} alt="Reference sheet" className="w-full h-auto" />
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
        <div className="text-sm font-semibold text-white">Dashboard (reference)</div>
        <div className="mt-3 overflow-auto rounded-xl border border-zinc-800">
          <img src={REF_DASHBOARD_IMG} alt="Dashboard reference" className="w-full h-auto" />
        </div>
      </div>
    </div>
  );
}

function Integrations({ embedUrl, setEmbedUrl }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center gap-2">
          <LinkIcon size={18} className="text-zinc-200" />
          <div className="text-sm font-semibold text-white">Integrations</div>
        </div>
        <div className="mt-2 text-sm text-zinc-300">Drop a URL for your portal page and view it side-by-side.</div>

        <label className="block mt-3">
          <div className="text-xs text-zinc-300">Portal URL (optional)</div>
          <input
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="https://your-team-portal/page"
            className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        {embedUrl ? (
          <iframe title="Portal embed" src={embedUrl} className="w-full h-[70vh]" />
        ) : (
          <div className="p-6 text-sm text-zinc-300">Add a Portal URL to embed it here.</div>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Import / Export
// -----------------------------------------------------------------------------
function ExportImport({ state, setState }) {
  const download = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `valorant-playbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file) => {
    const text = await file.text();
    const parsed = safeJsonParse(text);
    if (!parsed || !parsed.playbooks || !parsed.teams) {
      alert("Invalid playbook JSON.");
      return;
    }
    setState(normalizeState(parsed));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={download}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
      >
        <Download size={16} />
        Export
      </button>

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800">
        <Upload size={16} />
        Import
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

// -----------------------------------------------------------------------------
// App shell
// -----------------------------------------------------------------------------
export default function App() {
  const [state, setState] = useState(() => {
    const saved = typeof window !== "undefined" ? safeJsonParse(localStorage.getItem(STORAGE_KEY) || "") : null;
    return normalizeState(saved) || seedInitialState();
  });

  const [tab, setTab] = useState("Playbook");

  const [teamId, setTeamId] = useState(state.settings.activeTeamId);
  const [map, setMap] = useState("Lotus");
  const [side, setSide] = useState("Attack");

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    setTeamId(state.settings.activeTeamId);
  }, [state.settings.activeTeamId]);

  const activeTeam = state.teams.find((t) => t.id === teamId) || state.teams[0];

  const quickGlance = state.settings.quickGlance;
  const showReferencePanel = state.settings.showReferencePanel;

  const setQuickGlance = (v) => setState((prev) => ({ ...prev, settings: { ...prev.settings, quickGlance: v } }));
  const setShowReferencePanel = (v) =>
    setState((prev) => ({ ...prev, settings: { ...prev.settings, showReferencePanel: v } }));
  const setEmbedUrl = (v) => setState((prev) => ({ ...prev, settings: { ...prev.settings, embedUrl: v } }));

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-900 bg-zinc-950">
        <div className="mx-auto max-w-[1400px] px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold">Team Playbook — Preview</div>
              <div className="text-sm text-zinc-400">Flowchart + trigger dictionary + roster tracking.</div>
            </div>

            <div className="flex items-center gap-2">
              <ExportImport state={state} setState={setState} />
              <button
                onClick={() => setQuickGlance(!quickGlance)}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
              >
                {quickGlance ? <Eye size={16} /> : <EyeOff size={16} />}
                {quickGlance ? "Quick" : "Deep"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-900 bg-zinc-950 px-3 py-2">
              <div className="text-xs text-zinc-400">Team</div>
              <select
                value={teamId}
                onChange={(e) => {
                  const id = e.target.value;
                  setTeamId(id);
                  setState((prev) => ({ ...prev, settings: { ...prev.settings, activeTeamId: id } }));
                }}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white"
              >
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Pill>{(activeTeam?.players || []).length} players</Pill>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-zinc-900 bg-zinc-950 px-3 py-2">
              <div className="text-xs text-zinc-400">Map</div>
              <select
                value={map}
                onChange={(e) => setMap(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white"
              >
                {MAPS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {SIDES.map((s) => (
                <SideChip key={s} side={s} active={s === side} onClick={() => setSide(s)} />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <IconTab active={tab === "Playbook"} icon={Network} label="Playbook" onClick={() => setTab("Playbook")} />
              <IconTab active={tab === "Trigger Words"} icon={BookMarked} label="Trigger Words" onClick={() => setTab("Trigger Words")} />
              <IconTab active={tab === "Roster"} icon={BarChart3} label="Roster" onClick={() => setTab("Roster")} />
              <IconTab active={tab === "References"} icon={Layers} label="References" onClick={() => setTab("References")} />
              <IconTab active={tab === "Integrations"} icon={LinkIcon} label="Integrations" onClick={() => setTab("Integrations")} />
              <IconTab active={tab === "Settings"} icon={Settings} label="Settings" onClick={() => setTab("Settings")} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-4">
        {tab === "Playbook" ? (
          <ReactFlowProvider>
            <FlowEditor state={state} setState={setState} teamId={teamId} map={map} side={side} quickGlance={quickGlance} />
          </ReactFlowProvider>
        ) : null}

        {tab === "Trigger Words" ? <TriggerWordsPage state={state} setState={setState} /> : null}

        {tab === "Roster" ? <RosterPage state={state} setState={setState} teamId={teamId} /> : null}

        {tab === "References" ? (
          <References showReferencePanel={showReferencePanel} setShowReferencePanel={setShowReferencePanel} />
        ) : null}

        {tab === "Integrations" ? <Integrations embedUrl={state.settings.embedUrl} setEmbedUrl={setEmbedUrl} /> : null}

        {tab === "Settings" ? <SettingsPanel state={state} setState={setState} /> : null}
      </div>
    </div>
  );
}

function SettingsPanel({ state, setState }) {
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState("");

  const addTeam = () => {
    const name = teamName.trim();
    if (!name) return;

    const list = players.split(",").map((s) => s.trim()).filter(Boolean);
    const id = uid();

    setState((prev) => {
      const copy = structuredClone(prev);
      const newTeamPlayers = list.length ? list : ["Player1", "Player2", "Player3", "Player4", "Player5"];

      copy.teams.push({ id, name, players: newTeamPlayers });
      copy.settings.activeTeamId = id;

      copy.playbooks[id] = {};
      MAPS.forEach((m) => {
        copy.playbooks[id][m] = {};
        SIDES.forEach((s) => (copy.playbooks[id][m][s] = seedGraph(m, s)));
      });

      copy.roster[id] = seedRosterForTeam(newTeamPlayers);
      copy.starts[id] = seedStartsFromScreenshot();

      return copy;
    });

    setTeamName("");
    setPlayers("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="text-sm font-semibold text-white">Teams</div>
        <div className="mt-2 text-sm text-zinc-300">Add multiple rosters. Each team gets playbooks + roster tracking.</div>

        <div className="mt-3 space-y-2">
          {state.teams.map((t) => (
            <div key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-zinc-400">{(t.players || []).join(", ")}</div>
                </div>
                <button
                  onClick={() => {
                    if (!confirm("Delete team? This removes its playbooks + roster data.")) return;
                    setState((prev) => {
                      const copy = structuredClone(prev);
                      copy.teams = copy.teams.filter((x) => x.id !== t.id);
                      delete copy.playbooks[t.id];
                      delete copy.roster[t.id];
                      delete copy.starts[t.id];
                      if (copy.settings.activeTeamId === t.id) copy.settings.activeTeamId = copy.teams[0]?.id || "";
                      return copy;
                    });
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="text-sm font-semibold text-white">Add team</div>
          <label className="block mt-2">
            <div className="text-xs text-zinc-300">Team name</div>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder="e.g., Varsity"
            />
          </label>
          <label className="block mt-2">
            <div className="text-xs text-zinc-300">Players (comma separated)</div>
            <input
              value={players}
              onChange={(e) => setPlayers(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              placeholder="Player1, Player2, Player3, Player4, Player5"
            />
          </label>
          <button
            onClick={addTeam}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
          >
            <Plus size={16} />
            Add team
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="text-sm font-semibold text-white">How to use</div>
        <ol className="mt-2 list-decimal pl-5 text-sm text-zinc-300 space-y-2">
          <li>Build flows with visible triggers.</li>
          <li>Attach images to boxes for instant clarity.</li>
          <li>Use Roster to lock comps & map comfort fast.</li>
        </ol>
      </div>
    </div>
  );
}
