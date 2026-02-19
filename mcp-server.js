#!/usr/bin/env node

// commitchi MCP Server
// Lets Claude Code check on, pet, and interact with your commitchi pet.

const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".commitchi.json"
);

// ── Stages & Creatures ──────────────────────────────────────────────────────

const STAGES = [
  { name: "egg", min: 0, max: 99 },
  { name: "hatchling", min: 100, max: 499 },
  { name: "juvenile", min: 500, max: 1499 },
  { name: "adult", min: 1500, max: 3999 },
  { name: "legendary", min: 4000, max: Infinity },
];

const CREATURES = {
  egg: [
    "      .--.",
    "     /    \\",
    "    | ~  ~ |",
    "     \\    /",
    "      '--'",
  ],
  hatchling: [
    "    \\('o')/",
    "     /   \\",
    "    / \\ / \\",
    "      |",
  ],
  juvenile: [
    "    /\\_/\\",
    "   ( o.o )",
    "   > ^ <",
    "  /|   |\\",
    "  (_|   |_)",
  ],
  adult: [
    "     /\\_/\\",
    "   =( °w° )=",
    "    )   ( //",
    "   (__ __)//",
    '   " " " "',
  ],
  legendary: [
    "   ⭐ /\\_/\\ ⭐",
    "   =(  ✦‿✦  )=",
    " ~~  )     (  ~~",
    "    (__   __)  ",
    '    " " " "  ✨',
  ],
};

const REACTIONS = [
  "*purrs happily*",
  "*does a little spin*",
  "*wiggles with joy*",
  "*nuzzles your hand*",
  "*chirps excitedly*",
  "*bounces around*",
  "*sparkles with happiness*",
  "*hums a little tune*",
];

const MOODS = [
  "content and cozy",
  "happily snoozing",
  "playfully chasing bugs",
  "dreaming of green CI checks",
  "basking in merged PRs",
  "dancing on the main branch",
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

function getStreakMultiplier(streak) {
  if (streak >= 14) return 3;
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

function getProgressToNext(points) {
  const stage = getStage(points);
  if (stage.max === Infinity) return { progress: 1, next: "MAX" };
  const range = stage.max - stage.min + 1;
  const progress = Math.min((points - stage.min) / range, 1);
  return { progress: Math.round(progress * 100), next: stage.max + 1 };
}

// ── MCP Protocol ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_pet_status",
    description:
      "Check on your commitchi pet. Returns its current stage, stats, mood, ASCII art, and progress toward the next evolution. Use this to give the user updates about their pet.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "pet_the_pet",
    description:
      "Give the commitchi pet some affection! It will react with a cute animation. Use this to make the user smile.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_pet_advice",
    description:
      "Get personalized advice on how to help your commitchi grow based on current stats. Suggests what GitHub activity would help most.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

function handleGetPetStatus() {
  const config = loadConfig();
  if (!config.stats) {
    return {
      content: [
        {
          type: "text",
          text: "No commitchi found! Run `node ~/gitpet/cli.js` first to set up your pet.",
        },
      ],
    };
  }

  const stats = config.stats;
  const stage = getStage(stats.points);
  const art = CREATURES[stage.name].join("\n");
  const { progress, next } = getProgressToNext(stats.points);
  const mood = MOODS[Math.floor(Math.random() * MOODS.length)];
  const syncedAgo = Math.round((Date.now() - stats.fetchedAt) / 60000);
  const syncLabel = syncedAgo < 1 ? "just now" : `${syncedAgo}m ago`;

  const stageName = stage.name.charAt(0).toUpperCase() + stage.name.slice(1);

  const report = `🐾 ${stats.username}'s commitchi

${art}

Stage: ${stageName}
Mood: ${mood}
Points: ${stats.points} ${next === "MAX" ? "(MAXED OUT!)" : `(${progress}% to ${next} → next stage)`}

📊 Stats (last 30 days):
  Merged PRs: ${stats.prs}
  Commits: ${stats.commits}
  Streak: ${stats.streak} days (${stats.multiplier}x multiplier)

Last synced: ${syncLabel}`;

  return { content: [{ type: "text", text: report }] };
}

function handlePetThePet() {
  const config = loadConfig();
  if (!config.stats) {
    return {
      content: [
        {
          type: "text",
          text: "No commitchi to pet! Run `node ~/gitpet/cli.js` first.",
        },
      ],
    };
  }

  const stats = config.stats;
  const stage = getStage(stats.points);
  const reaction = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
  const art = CREATURES[stage.name].join("\n");

  // Record the pet interaction
  if (!config.interactions) config.interactions = {};
  config.interactions.lastPetted = Date.now();
  config.interactions.totalPets = (config.interactions.totalPets || 0) + 1;
  saveConfig(config);

  const response = `${art}

${reaction}

Your ${stage.name} loves the attention! (Total pets: ${config.interactions.totalPets})`;

  return { content: [{ type: "text", text: response }] };
}

function handleGetPetAdvice() {
  const config = loadConfig();
  if (!config.stats) {
    return {
      content: [
        {
          type: "text",
          text: "No commitchi found! Run `node ~/gitpet/cli.js` first.",
        },
      ],
    };
  }

  const stats = config.stats;
  const stage = getStage(stats.points);
  const { progress, next } = getProgressToNext(stats.points);
  const tips = [];

  if (stats.streak < 3) {
    tips.push(
      "🔥 Push code for 3 consecutive days to unlock the 1.5x streak multiplier!"
    );
  } else if (stats.streak < 7) {
    tips.push(
      `🔥 You're on a ${stats.streak}-day streak (1.5x)! Keep it up for 7 days to hit 2x!`
    );
  } else if (stats.streak < 14) {
    tips.push(
      `🔥 Amazing ${stats.streak}-day streak (2x)! 14 days unlocks the legendary 3x multiplier!`
    );
  } else {
    tips.push(
      `🔥 LEGENDARY ${stats.streak}-day streak! You have the maximum 3x multiplier!`
    );
  }

  if (stats.prs < 5) {
    tips.push(
      "💜 Merged PRs are worth 100 points each — try to merge a few more this month!"
    );
  }

  if (next !== "MAX") {
    const pointsNeeded = next - stats.points;
    const prsNeeded = Math.ceil(pointsNeeded / (100 * stats.multiplier));
    const commitsNeeded = Math.ceil(pointsNeeded / (10 * stats.multiplier));
    tips.push(
      `📈 Need ${pointsNeeded} more points to evolve. That's ~${prsNeeded} merged PRs or ~${commitsNeeded} commits (at ${stats.multiplier}x).`
    );
  } else {
    tips.push("👑 Your pet is MAXED OUT! You're a legend. Keep the streak alive!");
  }

  const advice = `Advice for ${stats.username}'s ${stage.name}:

${tips.join("\n\n")}`;

  return { content: [{ type: "text", text: advice }] };
}

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
    } catch (err) {
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
        serverInfo: { name: "commitchi", version: "1.0.0" },
      });
      break;

    case "notifications/initialized":
      // no response needed for notifications
      break;

    case "tools/list":
      sendResponse(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const toolName = params?.name;
      let result;
      switch (toolName) {
        case "get_pet_status":
          result = handleGetPetStatus();
          break;
        case "pet_the_pet":
          result = handlePetThePet();
          break;
        case "get_pet_advice":
          result = handleGetPetAdvice();
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

process.stderr.write("commitchi MCP server running on stdio\n");
