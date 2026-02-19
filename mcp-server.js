#!/usr/bin/env node

// tamago MCP Server
// Exposes tamago game state as tools for Claude Code.

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".tamago.json"
);

// ── Game Data (synced with cli.js) ──────────────────────────────────────────

const STAGES = [
  { name: "egg", min: 0, max: 99 },
  { name: "cracked", min: 100, max: 499 },
  { name: "chick", min: 500, max: 1999 },
  { name: "chicken", min: 2000, max: Infinity },
];

const CREATURES = {
  egg: [
    "       ___",
    "      /   \\",
    "     |     |",
    "     |     |",
    "      \\___/",
  ],
  cracked: [
    "      ,/\\_,",
    "     / o o \\",
    "     |  >  |",
    "     |     |",
    "      `---'",
  ],
  chick: [
    "      __",
    "     (o>",
    "     //\\",
    "     V_/_",
  ],
  chicken: [
    "      ,','",
    "     (  o>)",
    "     /    \\~~",
    "    |      |",
    "     _|  |_",
  ],
  evil_cracked: [
    "     v/\\_,v",
    "     / x x \\",
    "     |  >  |",
    "     | \\_/ |",
    "      `---'",
  ],
  evil_chick: [
    "     v__v",
    "     (x>",
    "    ~//\\~",
    "     V_/_",
  ],
  evil_chicken: [
    "     v','v",
    "     (  x>)",
    "    ~/    \\^~",
    "    |      |",
    "     _|  |_",
  ],
};

const ARCHETYPES = {
  streaker: { label: "Steady Streaker", desc: "Consistent daily coder" },
  sprinter: { label: "Hyperfocus Hacker", desc: "Intense burst coder" },
  reviewer: { label: "PR Wizard", desc: "Merge machine" },
  explorer: { label: "Zen Coder", desc: "Balanced and calm" },
};

const MILESTONES = [
  { id: "first_commit", check: (s) => s.commits >= 1, title: "First Warmth", desc: "First commit warmed the nest" },
  { id: "ten_commits", check: (s) => s.commits >= 10, title: "Incubating", desc: "10 commits keeping the egg warm" },
  { id: "fifty_commits", check: (s) => s.commits >= 50, title: "Toasty", desc: "50 commits -- shell is glowing" },
  { id: "hundred_commits", check: (s) => s.commits >= 100, title: "Overheating", desc: "100 commits in 30 days!" },
  { id: "first_pr", check: (s) => s.prs >= 1, title: "First Crack", desc: "First merged PR cracked the shell" },
  { id: "five_prs", check: (s) => s.prs >= 5, title: "Shell Breaker", desc: "5 merged PRs" },
  { id: "ten_prs", check: (s) => s.prs >= 10, title: "Hatch Master", desc: "10 merged PRs" },
  { id: "streak_3", check: (s) => s.streak >= 3, title: "Warm Streak", desc: "3-day push streak" },
  { id: "streak_7", check: (s) => s.streak >= 7, title: "Nest Guardian", desc: "7-day push streak" },
  { id: "streak_14", check: (s) => s.streak >= 14, title: "Eternal Flame", desc: "14-day push streak" },
  { id: "streak_30", check: (s) => s.streak >= 30, title: "The Incubator", desc: "30-day push streak" },
  { id: "points_500", check: (s) => s.points >= 500, title: "Cracking Open", desc: "Reached 500 XP" },
  { id: "points_1500", check: (s) => s.points >= 1500, title: "Little Chick", desc: "Reached 1500 XP" },
  { id: "points_2000", check: (s) => s.points >= 2000, title: "Full Chicken", desc: "Reached 2000 XP" },
];

const REACTIONS = [
  "*wobbles happily*",
  "*does a little spin*",
  "*wiggles with joy*",
  "*shell warms up*",
  "*bounces in the nest*",
  "*hums contentedly*",
  "*glows a little brighter*",
  "*nestles closer*",
];

const AMBIENT = [
  "warm and toasty",
  "snug in the nest",
  "quietly incubating",
  "dreaming of merges",
  "basking in green CI checks",
  "resting between deploys",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

function getStage(points) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (points >= STAGES[i].min) return STAGES[i];
  }
  return STAGES[0];
}

function getArchetype(stats) {
  if (stats.streak >= 7) return "streaker";
  if (stats.commits >= 50) return "sprinter";
  if (stats.prs >= 8) return "reviewer";
  return "explorer";
}

function getProgressToNext(points) {
  const stage = getStage(points);
  if (stage.max === Infinity) return { percent: 100, next: "MAX" };
  const range = stage.max - stage.min + 1;
  const percent = Math.round(Math.min((points - stage.min) / range, 1) * 100);
  return { percent, next: stage.max + 1 };
}

function progressBar(percent, width) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return "[" + "#".repeat(filled) + "-".repeat(empty) + "]";
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getCreatureKey(stats, config) {
  const stage = getStage(stats.points).name;
  if (stage === "egg") return stage;
  const fs = config.funStats;
  if (fs && fs.totalLinesDeleted > fs.totalLinesAdded) {
    return "evil_" + stage;
  }
  return stage;
}

// ── Tool Handlers ───────────────────────────────────────────────────────────

function handleGetPetScreen() {
  const config = loadConfig();
  if (!config.stats) {
    return text("No tamago found. Run `tamago` or `node ~/gitpet/cli.js` first to hatch your egg.");
  }

  const stats = config.stats;
  const stage = getStage(stats.points);
  const creatureKey = getCreatureKey(stats, config);
  const isEvil = creatureKey.startsWith("evil_");
  const stageName = stage.name.charAt(0).toUpperCase() + stage.name.slice(1);
  const stageLabel = isEvil ? `${stageName} (evil)` : stageName;
  const art = CREATURES[creatureKey].join("\n");
  const { percent, next } = getProgressToNext(stats.points);
  const archetype = ARCHETYPES[getArchetype(stats)];
  const mood = pick(AMBIENT);
  const bar = progressBar(percent, 20);
  const syncedAgo = Math.round((Date.now() - stats.fetchedAt) / 60000);
  const syncLabel = syncedAgo < 1 ? "just now" : `${syncedAgo}m ago`;

  const unlocked = Object.keys(config.milestones || {}).length;
  const fs_ = config.funStats || {};
  const linesLine = fs_.totalLinesAdded != null
    ? `\n  Lines: +${fs_.totalLinesAdded} / -${fs_.totalLinesDeleted}`
    : "";

  const screen = `${stats.username}'s tamago

${art}

  *${mood}*

  Stage: ${stageLabel}  |  ${archetype.label}
  ${bar} ${next === "MAX" ? "MAX" : `${stats.points}/${next} XP`}

  ${stats.points} pts  |  ${stats.prs} PRs  |  ${stats.commits} commits  |  ${stats.streak}d streak (${stats.multiplier}x)${linesLine}
  ${unlocked}/${MILESTONES.length} achievements  |  synced ${syncLabel}`;

  return text(screen);
}

function handlePetThePet() {
  const config = loadConfig();
  if (!config.stats) {
    return text("No tamago to pet. Run `tamago` first.");
  }

  const stats = config.stats;
  const creatureKey = getCreatureKey(stats, config);
  const reaction = pick(REACTIONS);
  const art = CREATURES[creatureKey].join("\n");

  if (!config.interactions) config.interactions = {};
  config.interactions.lastPetted = Date.now();
  config.interactions.totalPets = (config.interactions.totalPets || 0) + 1;
  saveConfig(config);

  return text(`${art}\n\n  ${reaction}\n\n  (petted ${config.interactions.totalPets} times total)`);
}

function handleGetAdvice() {
  const config = loadConfig();
  if (!config.stats) {
    return text("No tamago found. Run `tamago` first.");
  }

  const stats = config.stats;
  const stage = getStage(stats.points);
  const { next } = getProgressToNext(stats.points);
  const tips = [];

  if (stats.streak < 3) {
    tips.push("Push code 3 days in a row to unlock the 1.5x streak multiplier.");
  } else if (stats.streak < 7) {
    tips.push(`${stats.streak}-day streak (1.5x). Keep going for 7 days to hit 2x.`);
  } else if (stats.streak < 14) {
    tips.push(`${stats.streak}-day streak (2x). 14 days unlocks the max 3x multiplier.`);
  } else {
    tips.push(`${stats.streak}-day streak -- max 3x multiplier. Keep it alive.`);
  }

  if (stats.prs < 5) {
    tips.push("Merged PRs are worth 100 pts each. Try to merge a few more this month.");
  }

  if (next !== "MAX") {
    const pointsNeeded = next - stats.points;
    const prsNeeded = Math.ceil(pointsNeeded / (100 * stats.multiplier));
    const commitsNeeded = Math.ceil(pointsNeeded / (10 * stats.multiplier));
    tips.push(`${pointsNeeded} pts to next stage. That's ~${prsNeeded} PRs or ~${commitsNeeded} commits at ${stats.multiplier}x.`);
  } else {
    tips.push("Your egg is MAXED OUT. You're cosmic. Keep the streak alive.");
  }

  return text(`Advice for ${stats.username}'s ${stage.name}:\n\n${tips.map(t => "  - " + t).join("\n")}`);
}

function handleGetAchievements() {
  const config = loadConfig();
  const stats = config.stats;
  const milestones = config.milestones || {};

  const lines = ["Achievements:\n"];
  for (const m of MILESTONES) {
    const unlocked = !!milestones[m.id];
    const icon = unlocked ? "[x]" : "[ ]";
    lines.push(`  ${icon} ${m.title} -- ${m.desc}`);
  }

  const count = Object.keys(milestones).length;
  lines.push(`\n  ${count}/${MILESTONES.length} unlocked`);

  return text(lines.join("\n"));
}

function handleGetBadges() {
  const config = loadConfig();
  const badges = config.badges || {};
  const funStats = config.funStats || {};

  const BADGES = [
    { id: "commits_10",  tier: "bronze", icon: "🥉", title: "Steady Hand",     desc: "Merged a PR with 10+ commits",   category: "Commits" },
    { id: "commits_50",  tier: "silver", icon: "🥈", title: "Commit Machine",  desc: "Merged a PR with 50+ commits",   category: "Commits" },
    { id: "commits_100", tier: "gold",   icon: "🥇", title: "Commit Legend",   desc: "Merged a PR with 100+ commits",  category: "Commits" },
    { id: "approvers_3",  tier: "bronze", icon: "🥉", title: "Team Player",     desc: "PR approved by 3+ reviewers",    category: "Reviews" },
    { id: "approvers_5",  tier: "silver", icon: "🥈", title: "Crowd Pleaser",   desc: "PR approved by 5+ reviewers",    category: "Reviews" },
    { id: "approvers_10", tier: "gold",   icon: "🥇", title: "Community Hero",  desc: "PR approved by 10+ reviewers",   category: "Reviews" },
    { id: "langs_3", tier: "bronze", icon: "🥉", title: "Bilingual",       desc: "PR in a repo with 3+ languages", category: "Languages" },
    { id: "langs_5", tier: "silver", icon: "🥈", title: "Polyglot",        desc: "PR in a repo with 5+ languages", category: "Languages" },
    { id: "langs_8", tier: "gold",   icon: "🥇", title: "Universal Coder", desc: "PR in a repo with 8+ languages", category: "Languages" },
  ];

  const lines = ["Badges (per-PR achievements):\n"];
  const categories = ["Commits", "Reviews", "Languages"];
  for (const cat of categories) {
    lines.push(`  ${cat}`);
    for (const b of BADGES.filter((x) => x.category === cat)) {
      const u = badges[b.id];
      if (u) {
        lines.push(`  [x] ${b.icon} ${b.title} -- ${b.desc}  (${u.pr})`);
      } else {
        lines.push(`  [ ]    ${b.title} -- ${b.desc}`);
      }
    }
    lines.push("");
  }

  const count = Object.keys(badges).length;
  lines.push(`  ${count}/${BADGES.length} badges unlocked`);

  if (funStats.totalLinesAdded != null) {
    lines.push("\n  Fun Stats:");
    lines.push(`  Lines: +${funStats.totalLinesAdded} / -${funStats.totalLinesDeleted}`);
    lines.push(`  Files changed: ${funStats.totalFilesChanged}`);
    lines.push(`  Repos: ${funStats.reposContributed}`);
    if (funStats.biggestPR) {
      lines.push(`  Biggest PR: ${funStats.biggestPR.repo}#${funStats.biggestPR.number} (${funStats.biggestPR.commits} commits)`);
    }
    if (funStats.fastestMerge) {
      lines.push(`  Fastest merge: ${funStats.fastestMerge.repo}#${funStats.fastestMerge.number} (${funStats.fastestMerge.hours}h)`);
    }
  }

  return text(lines.join("\n"));
}

function text(t) {
  return { content: [{ type: "text", text: t }] };
}

// ── MCP Tools Definition ────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_tamago",
    description:
      "Get the full tamago game screen -- ASCII art, stats, progress bar, mood, and achievements count. Use this whenever the user wants to see their pet or check on it.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pet_tamago",
    description:
      "Give the tamago some affection. It reacts with a cute message. Use when the user wants to interact with or pet their egg.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "tamago_advice",
    description:
      "Get tips on how to help the tamago grow based on current GitHub stats. Suggests what activity would earn the most points.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "tamago_achievements",
    description:
      "Show all tamago achievements/milestones and which ones are unlocked.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "tamago_badges",
    description:
      "View per-PR badge progress (bronze/silver/gold tiers) and fun stats like lines added, fastest merge, and biggest PR.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

// ── JSON-RPC / stdio transport ──────────────────────────────────────────────

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;

  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;

    const header = buffer.slice(0, headerEnd);
    const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!contentLengthMatch) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(contentLengthMatch[1], 10);
    const bodyStart = headerEnd + 4;

    if (buffer.length < bodyStart + contentLength) break;

    const body = buffer.slice(bodyStart, bodyStart + contentLength);
    buffer = buffer.slice(bodyStart + contentLength);

    try {
      const msg = JSON.parse(body);
      handleMessage(msg);
    } catch {
      sendError(null, -32700, "Parse error");
    }
  }
});

function sendResponse(id, result) {
  const body = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function sendError(id, code, message) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "tamago", version: "2.0.0" },
      });
      break;

    case "notifications/initialized":
      break;

    case "tools/list":
      sendResponse(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const toolName = params?.name;
      let result;
      switch (toolName) {
        case "get_tamago":
          result = handleGetPetScreen();
          break;
        case "pet_tamago":
          result = handlePetThePet();
          break;
        case "tamago_advice":
          result = handleGetAdvice();
          break;
        case "tamago_achievements":
          result = handleGetAchievements();
          break;
        case "tamago_badges":
          result = handleGetBadges();
          break;
        default:
          sendError(id, -32601, `Unknown tool: ${toolName}`);
          return;
      }
      sendResponse(id, result);
      break;
    }

    default:
      if (id !== undefined) {
        sendError(id, -32601, `Method not found: ${method}`);
      }
  }
}

process.stderr.write("tamago MCP server running on stdio\n");
