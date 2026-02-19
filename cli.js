#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

// ── Config ──────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".commitchi.json"
);
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const FRAME_INTERVAL = 800;
const MESSAGE_INTERVAL = 4000;

// ── Creature Stages ─────────────────────────────────────────────────────────

const STAGES = [
  { name: "egg", min: 0, max: 99 },
  { name: "hatchling", min: 100, max: 499 },
  { name: "juvenile", min: 500, max: 1499 },
  { name: "adult", min: 1500, max: 3999 },
  { name: "legendary", min: 4000, max: Infinity },
];

const CREATURES = {
  egg: [
    [
      "      .--.",
      "     /    \\",
      "    | ~  ~ |",
      "     \\    /",
      "      '--'",
    ],
    [
      "      .--.",
      "     /    \\",
      "    |  ~~  |",
      "     \\    /",
      "      '--'",
    ],
    [
      "      .--.",
      "     /    \\",
      "    | ~  ~ |",
      "     \\  . /",
      "      '--'",
    ],
  ],
  hatchling: [
    [
      "    \\('o')/",
      "     /   \\",
      "    / \\ / \\",
      "      |",
    ],
    [
      "    \\(^o^)/",
      "     /   \\",
      "    / \\ / \\",
      "      |",
    ],
    [
      "    \\('o')/",
      "      |",
      "    / \\ / \\",
      "      |",
    ],
  ],
  juvenile: [
    [
      "    /\\_/\\",
      "   ( o.o )",
      "   > ^ <",
      "  /|   |\\",
      "  (_|   |_)",
    ],
    [
      "    /\\_/\\",
      "   ( -.- )",
      "   > ^ <",
      "  /|   |\\",
      "  (_|   |_)",
    ],
    [
      "    /\\_/\\",
      "   ( o.o )",
      "   > ~ <",
      "  /|   |\\",
      "  (_|   |_)",
    ],
  ],
  adult: [
    [
      "     /\\_/\\",
      "   =( °w° )=",
      "    )   ( //",
      "   (__ __)//",
      '   " " " "',
    ],
    [
      "     /\\_/\\",
      "   =( °‿° )=",
      "    )   ( //",
      "   (__ __)//",
      '   " " " "',
    ],
    [
      "     /\\_/\\",
      "   =( °w° )=",
      "    ) ~ ( //",
      "   (__ __)//",
      '   " " " "',
    ],
  ],
  legendary: [
    [
      "   ⭐ /\\_/\\ ⭐",
      "   =(  ✦‿✦  )=",
      " ~~  )     (  ~~",
      "    (__   __)  ",
      '    " " " "  ✨',
    ],
    [
      "   ✨ /\\_/\\ ✨",
      "   =(  ✦w✦  )=",
      " ~~  )     (  ~~",
      "    (__   __)  ",
      '    " " " "  ⭐',
    ],
    [
      "   ⭐ /\\_/\\ ⭐",
      "   =(  ✦‿✦  )=",
      " ~~ )  ~  (  ~~",
      "    (__   __)  ",
      '    " " " "  ✨',
    ],
  ],
};

// ── Mood System ─────────────────────────────────────────────────────────────

const MOODS = {
  energized: {
    label: "⚡ Energized",
    messages: [
      "*bouncing off the walls*",
      "*typing furiously*",
      "*sprinting through the codebase*",
      "*buzzing with energy*",
      "*doing rapid-fire commits*",
    ],
  },
  happy: {
    label: "😊 Happy",
    messages: [
      "*humming a happy tune*",
      "*doing a little dance*",
      "*basking in green CI checks*",
      "*smiling at merged PRs*",
      "*playing with git branches*",
    ],
  },
  cozy: {
    label: "🛋️  Cozy",
    messages: [
      "*snoozing peacefully*",
      "*napping on the main branch*",
      "*dreaming of merges*",
      "*curled up with a good diff*",
      "*resting between deploys*",
    ],
  },
  focused: {
    label: "🎯 Focused",
    messages: [
      "*deep in code review*",
      "*polishing some code*",
      "*thinking about refactors*",
      "*carefully crafting a commit*",
      "*studying the architecture*",
    ],
  },
  inspired: {
    label: "✨ Inspired",
    messages: [
      "*staring at the stars*",
      "*sketching new features*",
      "*having a eureka moment*",
      "*dreaming up big ideas*",
      "*exploring new repos*",
    ],
  },
};

function getMood(stats) {
  const hoursSinceSync = (Date.now() - stats.fetchedAt) / (1000 * 60 * 60);
  if (stats.streak >= 7 && stats.prs >= 5) return "energized";
  if (stats.streak >= 3) return "happy";
  if (stats.commits >= 30) return "focused";
  if (stats.prs >= 3) return "inspired";
  return "cozy";
}

function getAmbientMessages(stats) {
  const mood = getMood(stats);
  return MOODS[mood].messages;
}

function getMoodLabel(stats) {
  const mood = getMood(stats);
  return MOODS[mood].label;
}

// ── ANSI Helpers ────────────────────────────────────────────────────────────

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;
const CYAN = `${ESC}36m`;
const GREEN = `${ESC}32m`;
const YELLOW = `${ESC}33m`;
const MAGENTA = `${ESC}35m`;
const WHITE = `${ESC}37m`;
const BRIGHT_CYAN = `${ESC}96m`;
const BRIGHT_GREEN = `${ESC}92m`;
const BRIGHT_YELLOW = `${ESC}93m`;
const BRIGHT_MAGENTA = `${ESC}95m`;
const BG_BLACK = `${ESC}40m`;
const HIDE_CURSOR = `${ESC}?25l`;
const SHOW_CURSOR = `${ESC}?25h`;
const CLEAR = `${ESC}2J${ESC}H`;

function moveTo(row, col) {
  return `${ESC}${row};${col}H`;
}

// ── Config I/O ──────────────────────────────────────────────────────────────

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

// ── GitHub API ──────────────────────────────────────────────────────────────

function githubRequest(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "commitchi-cli",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function fetchUsername(token) {
  const user = await githubRequest("/user", token);
  return user.login;
}

async function fetchMergedPRs(token, username) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const query = encodeURIComponent(
    `author:${username} type:pr is:merged merged:>=${since}`
  );
  const result = await githubRequest(
    `/search/issues?q=${query}&per_page=1`,
    token
  );
  return result.total_count || 0;
}

async function fetchCommits(token, username) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const query = encodeURIComponent(
    `author:${username} committer-date:>=${since}`
  );
  const result = await githubRequest(
    `/search/commits?q=${query}&per_page=1`,
    token
  );
  return result.total_count || 0;
}

async function fetchStreak(token, username) {
  // Check recent push events to calculate streak
  const events = await githubRequest(
    `/users/${username}/events?per_page=100`,
    token
  );
  const pushDays = new Set();
  for (const event of events) {
    if (event.type === "PushEvent") {
      pushDays.add(event.created_at.split("T")[0]);
    }
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (pushDays.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      // allow today to be missing (day not over yet)
      break;
    }
  }
  return streak;
}

function getStreakMultiplier(streak) {
  if (streak >= 14) return 3;
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

function calcPoints(prs, commits, streak) {
  return Math.floor((prs * 100 + commits * 10) * getStreakMultiplier(streak));
}

async function fetchAllStats(token) {
  const username = await fetchUsername(token);
  const [prs, commits, streak] = await Promise.all([
    fetchMergedPRs(token, username),
    fetchCommits(token, username),
    fetchStreak(token, username),
  ]);
  const multiplier = getStreakMultiplier(streak);
  const points = calcPoints(prs, commits, streak);
  return {
    username,
    prs,
    commits,
    streak,
    multiplier,
    points,
    fetchedAt: Date.now(),
  };
}

// ── Stage Logic ─────────────────────────────────────────────────────────────

function getStage(points) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (points >= STAGES[i].min) return STAGES[i];
  }
  return STAGES[0];
}

function getProgressToNext(points) {
  const stage = getStage(points);
  if (stage.max === Infinity) return 1;
  const range = stage.max - stage.min + 1;
  const progress = points - stage.min;
  return Math.min(progress / range, 1);
}

// ── Banner ──────────────────────────────────────────────────────────────────

const BANNER = [
  " ██████╗ ██████╗ ███╗   ███╗███╗   ███╗██╗████████╗ ██████╗██╗  ██╗██╗",
  "██╔════╝██╔═══██╗████╗ ████║████╗ ████║██║╚══██╔══╝██╔════╝██║  ██║██║",
  "██║     ██║   ██║██╔████╔██║██╔████╔██║██║   ██║   ██║     ███████║██║",
  "██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██║   ██║   ██║     ██╔══██║██║",
  "╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║   ██║   ╚██████╗██║  ██║██║",
  " ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝",
];

const BANNER_COLORS = [
  `${ESC}38;5;199m`, // hot pink
  `${ESC}38;5;206m`, // pink
  `${ESC}38;5;213m`, // light pink
  `${ESC}38;5;177m`, // lavender
  `${ESC}38;5;141m`, // purple
  `${ESC}38;5;135m`, // deep purple
];

// ── Rendering ───────────────────────────────────────────────────────────────

function renderProgressBar(progress, width) {
  const filled = Math.round(progress * width);
  const empty = width - filled;
  const bar =
    `${GREEN}${"█".repeat(filled)}${DIM}${"░".repeat(empty)}${RESET}`;
  return `[${bar}]`;
}

function centerText(text, width) {
  // Strip ANSI for length calculation
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  const pad = Math.max(0, Math.floor((width - stripped.length) / 2));
  return " ".repeat(pad) + text;
}

function render(stats, frameIndex, ambientMsg) {
  const { columns: w, rows: h } = process.stdout;
  const stage = getStage(stats.points);
  const frames = CREATURES[stage.name];
  const frame = frames[frameIndex % frames.length];
  const progress = getProgressToNext(stats.points);

  const lines = [];

  // Banner
  const bannerFits = w >= 76;
  if (bannerFits) {
    for (let i = 0; i < BANNER.length; i++) {
      const color = BANNER_COLORS[i % BANNER_COLORS.length];
      lines.push(`${BOLD}${color}${BANNER[i]}${RESET}`);
    }
  } else {
    lines.push(`${BOLD}${BRIGHT_CYAN}✿ commitchi ✿${RESET}`);
  }
  lines.push("");

  // Creature name + stage + mood
  const stageName = stage.name.charAt(0).toUpperCase() + stage.name.slice(1);
  const moodLabel = getMoodLabel(stats);
  lines.push(
    centerText(
      `${BRIGHT_MAGENTA}~ ${stats.username}'s pet ~${RESET}  ${DIM}[${stageName}]${RESET}  ${moodLabel}`,
      w
    )
  );
  lines.push("");

  // Creature frames
  for (const line of frame) {
    lines.push(centerText(`${BRIGHT_YELLOW}${line}${RESET}`, w));
  }
  lines.push("");

  // Ambient message
  lines.push(
    centerText(`${DIM}${MAGENTA}${ambientMsg}${RESET}`, w)
  );
  lines.push("");

  // XP bar
  const barWidth = Math.min(30, w - 20);
  const nextStage =
    stage.max === Infinity
      ? "MAX"
      : `${stats.points}/${stage.max + 1} XP`;
  lines.push(
    centerText(
      `${renderProgressBar(progress, barWidth)} ${DIM}${nextStage}${RESET}`,
      w
    )
  );
  lines.push("");

  // Stats
  lines.push(
    centerText(
      `${BRIGHT_GREEN}${stats.points} pts${RESET}  ${CYAN}${stats.prs} PRs${RESET}  ${WHITE}${stats.commits} commits${RESET}  ${BRIGHT_YELLOW}🔥 ${stats.streak}d streak${RESET}  ${DIM}(${stats.multiplier}x)${RESET}`,
      w
    )
  );
  lines.push("");

  // Last synced
  const syncedAgo = Math.round((Date.now() - stats.fetchedAt) / 60000);
  const syncLabel = syncedAgo < 1 ? "just now" : `${syncedAgo}m ago`;
  lines.push(
    centerText(`${DIM}last synced: ${syncLabel}${RESET}`, w)
  );

  // Bottom border
  lines.push("");
  lines.push(
    centerText(
      `${DIM}${"─".repeat(Math.min(50, w - 4))}${RESET}`,
      w
    )
  );
  lines.push(
    centerText(`${DIM}press q to quit${RESET}`, w)
  );

  // Vertically center
  const totalLines = lines.length;
  const topPad = Math.max(0, Math.floor((h - totalLines) / 2));

  let output = CLEAR;
  for (let i = 0; i < topPad; i++) output += "\n";
  for (const line of lines) output += line + "\n";

  process.stdout.write(output);
}

// ── Token Prompt ────────────────────────────────────────────────────────────

function printBanner() {
  console.log("");
  for (let i = 0; i < BANNER.length; i++) {
    const color = BANNER_COLORS[i % BANNER_COLORS.length];
    console.log(BOLD + color + BANNER[i] + RESET);
  }
  console.log("");
}

// ── Device Flow ─────────────────────────────────────────────────────────────

const GITHUB_CLIENT_ID = "PASTE_YOUR_CLIENT_ID_HERE"; // Replace with your OAuth App client ID

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => resolve(JSON.parse(raw)));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function deviceFlowAuth() {
  // Step 1: Request device code
  const codeRes = await httpsPost("github.com", "/login/device/code", {
    client_id: GITHUB_CLIENT_ID,
    scope: "read:user repo",
  });

  if (codeRes.error) {
    throw new Error(`Device flow error: ${codeRes.error_description || codeRes.error}`);
  }

  const { device_code, user_code, verification_uri, interval } = codeRes;

  // Step 2: Show the code and open browser
  console.log("");
  console.log(
    `  ${BOLD}${BRIGHT_YELLOW}▸ Your code: ${WHITE}${user_code}${RESET}`
  );
  console.log("");
  console.log(
    `  ${DIM}Opening ${verification_uri} in your browser...${RESET}`
  );
  console.log(
    `  ${DIM}Paste the code above and click authorize.${RESET}`
  );
  console.log("");

  // Open browser
  try {
    execSync(`open "${verification_uri}"`, { stdio: "ignore" });
  } catch {
    console.log(
      `  ${YELLOW}Couldn't open browser. Go to: ${verification_uri}${RESET}`
    );
  }

  // Step 3: Poll for token
  process.stdout.write(`  ${DIM}Waiting for authorization...${RESET}`);
  const pollInterval = (interval || 5) * 1000;

  while (true) {
    await sleep(pollInterval);

    const tokenRes = await httpsPost(
      "github.com",
      "/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }
    );

    if (tokenRes.access_token) {
      process.stdout.write("\n");
      console.log(`\n  ${GREEN}Authorized!${RESET}`);
      return tokenRes.access_token;
    }

    if (tokenRes.error === "authorization_pending") {
      process.stdout.write(".");
      continue;
    }

    if (tokenRes.error === "slow_down") {
      await sleep(5000);
      process.stdout.write(".");
      continue;
    }

    if (tokenRes.error === "expired_token") {
      throw new Error("Code expired. Please try again.");
    }

    throw new Error(
      tokenRes.error_description || tokenRes.error || "Authorization failed"
    );
  }
}

// ── gh CLI helpers ──────────────────────────────────────────────────────────

function tryGhToken() {
  try {
    // Unset GITHUB_TOKEN so gh reads from keyring instead
    const token = execSync("unset GITHUB_TOKEN && gh auth token 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
      shell: "/bin/zsh",
      env: { ...process.env, GITHUB_TOKEN: undefined },
    }).trim();
    if (token && (token.startsWith("gho_") || token.startsWith("ghp_") || token.startsWith("github_pat_"))) return token;
  } catch {}
  return null;
}

function listGhAccounts() {
  try {
    const output = execSync("gh auth status 2>&1", {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, GITHUB_TOKEN: undefined },
    });
    const accounts = [];
    const regex = /Logged in to github\.com account (\S+)/g;
    let match;
    while ((match = regex.exec(output))) {
      accounts.push(match[1]);
    }
    return accounts;
  } catch {}
  return [];
}

function switchGhAccount(account) {
  try {
    execSync(`gh auth switch --user ${account} 2>/dev/null`, {
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, GITHUB_TOKEN: undefined },
    });
    return tryGhToken();
  } catch {}
  return null;
}

function promptChoice(question, options) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    for (let i = 0; i < options.length; i++) {
      console.log(`  ${BRIGHT_CYAN}${i + 1}${RESET}) ${options[i]}`);
    }
    console.log("");
    rl.question(question, (answer) => {
      rl.close();
      resolve(parseInt(answer.trim(), 10));
    });
  });
}

function promptText(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptToken() {
  printBanner();
  console.log(
    `  ${BRIGHT_MAGENTA}Your GitHub activity feeds an ASCII pet that lives in your terminal.${RESET}`
  );
  console.log(
    `  ${DIM}It grows as you code — commits, PRs, and streaks earn XP.${RESET}`
  );
  console.log(
    `  ${DIM}No data leaves your machine. No servers. Just vibes.${RESET}`
  );
  console.log("");
  console.log(
    `  ${BRIGHT_CYAN}HOW IT WORKS${RESET}`
  );
  console.log(
    `  ${DIM}1. Sign in with GitHub below${RESET}`
  );
  console.log(
    `  ${DIM}2. Your pet appears — animated and idle in the terminal${RESET}`
  );
  console.log(
    `  ${DIM}3. Keep coding to level up: egg → hatchling → juvenile → adult → legendary${RESET}`
  );
  console.log(
    `  ${DIM}4. Press ${WHITE}q${DIM} to quit anytime. Stats auto-refresh every 15 min.${RESET}`
  );
  console.log("");

  // Build options list
  const options = [];
  const actions = [];

  // Device flow is always first (primary)
  options.push(`${BOLD}Login with GitHub${RESET} ${DIM}(opens browser)${RESET}`);
  actions.push("device");

  // gh CLI accounts if available
  const accounts = listGhAccounts();
  for (const a of accounts) {
    options.push(`Use gh CLI as ${BOLD}${a}${RESET}`);
    actions.push(`gh:${a}`);
  }

  // Manual paste as last resort
  options.push("Paste a token manually");
  actions.push("manual");

  const choice = await promptChoice(
    `${BRIGHT_GREEN}Choose [1-${options.length}]: ${RESET}`,
    options
  );

  const idx = (choice || 1) - 1;
  const action = actions[idx] || "device";

  // Device flow
  if (action === "device") {
    try {
      return await deviceFlowAuth();
    } catch (err) {
      console.log(`\n${YELLOW}Device flow failed: ${err.message}${RESET}`);
      console.log(`${DIM}Falling back to manual token...${RESET}\n`);
    }
  }

  // gh CLI
  if (action.startsWith("gh:")) {
    const account = action.slice(3);
    console.log(`\n${DIM}Switching to ${account}...${RESET}`);
    const token = switchGhAccount(account);
    if (token) {
      console.log(`${GREEN}Authenticated via GitHub CLI${RESET}`);
      return token;
    }
    console.log(`${YELLOW}Couldn't get token from gh, falling back...${RESET}\n`);
  }

  // Manual fallback
  console.log(
    `${DIM}Create a token at: https://github.com/settings/tokens${RESET}`
  );
  console.log(`${DIM}Scopes needed: read:user, repo (for private repos)${RESET}\n`);
  return await promptText(`${BRIGHT_GREEN}GitHub Personal Access Token: ${RESET}`);
}

// ── Main Loop ───────────────────────────────────────────────────────────────

async function main() {
  let config = loadConfig();

  // First run: get token
  if (!config.token) {
    const token = await promptToken();
    if (!token) {
      console.log("No token provided. Exiting.");
      process.exit(1);
    }
    config.token = token;
    // Validate token
    try {
      console.log(`\n${DIM}Validating token...${RESET}`);
      const username = await fetchUsername(token);
      console.log(`${GREEN}Authenticated as ${username}${RESET}`);
    } catch (err) {
      console.error(`${ESC}31mInvalid token: ${err.message}${RESET}`);
      process.exit(1);
    }
    saveConfig(config);
  }

  // Fetch stats (or use cache)
  let stats = config.stats;
  const stale = !stats || Date.now() - stats.fetchedAt > CACHE_TTL;

  if (stale) {
    console.log(`\n${DIM}Fetching GitHub stats...${RESET}`);
    try {
      stats = await fetchAllStats(config.token);
      config.stats = stats;
      saveConfig(config);
    } catch (err) {
      if (stats) {
        console.log(
          `${YELLOW}Fetch failed, using cached stats.${RESET}`
        );
      } else {
        console.error(`${ESC}31mFailed to fetch stats: ${err.message}${RESET}`);
        process.exit(1);
      }
    }
  }

  // Enter raw mode for keypress detection
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdout.write(HIDE_CURSOR);

  let frameIndex = 0;
  let moodMessages = getAmbientMessages(stats);
  let messageIndex = Math.floor(Math.random() * moodMessages.length);
  let ambientMsg = moodMessages[messageIndex];
  let running = true;

  // Handle input
  process.stdin.on("data", (key) => {
    if (key === "q" || key === "\x03") {
      // q or Ctrl+C
      running = false;
      cleanup();
    }
  });

  function cleanup() {
    process.stdout.write(SHOW_CURSOR);
    process.stdout.write(CLEAR);
    const stage = getStage(stats.points);
    console.log(
      `\n${BRIGHT_CYAN}✿ ${stats.username}'s ${stage.name} waves goodbye! ✿${RESET}\n`
    );
    console.log(`${DIM}${stats.points} pts | ${stats.streak}d streak | See you next commit!${RESET}\n`);
    process.exit(0);
  }

  // Handle terminal resize
  process.stdout.on("resize", () => {
    if (running) render(stats, frameIndex, ambientMsg);
  });

  // Animation loop
  const animTimer = setInterval(() => {
    if (!running) return;
    frameIndex = (frameIndex + 1) % 3;
    render(stats, frameIndex, ambientMsg);
  }, FRAME_INTERVAL);

  // Ambient message rotation
  const msgTimer = setInterval(() => {
    if (!running) return;
    moodMessages = getAmbientMessages(stats);
    messageIndex = (messageIndex + 1) % moodMessages.length;
    ambientMsg = moodMessages[messageIndex];
  }, MESSAGE_INTERVAL);

  // Initial render
  render(stats, frameIndex, ambientMsg);

  // Background re-fetch every 15 min
  const fetchTimer = setInterval(async () => {
    if (!running) return;
    try {
      stats = await fetchAllStats(config.token);
      config.stats = stats;
      saveConfig(config);
    } catch {
      // silently keep using cached
    }
  }, CACHE_TTL);

  // Cleanup on process signals
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  process.stdout.write(SHOW_CURSOR);
  console.error(`\n${ESC}31mError: ${err.message}${RESET}`);
  process.exit(1);
});
