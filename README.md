# tamago

An idle CLI pet that hatches and grows from your GitHub activity. Like a Tamagotchi in your terminal — always animated, always cozy, no negatives.

## Quick Start

```bash
node cli.js
```

On first run, pick a GitHub account from your `gh` CLI or paste a token.

## Commands

```
node cli.js                 # Launch interactive pet viewer
node cli.js status          # Quick stats snapshot
node cli.js pet             # Give your pet some love
node cli.js achievements    # View all milestones
node cli.js badges          # View per-PR badges and fun stats
node cli.js graduate        # Retire a Legendary pet, start new generation
node cli.js lineage         # View history of graduated pets
node cli.js reset           # Clear config and start over
node cli.js help            # Show help
```

## How it works

- Fetches your merged PRs, commits, and push streak from the last 30 days
- Calculates points: `(PRs × 100 + commits × 10) × streak_multiplier`
- Your ASCII creature evolves through 5 stages with archetype branching
- Stats cache for 15 minutes, then auto-refresh
- Daily check-in bonus awards escalating points
- Pet sleeps at night (11pm–6am) with a cute animation

## Scoring

| Streak     | Multiplier |
|------------|------------|
| 0–2 days   | 1x         |
| 3–6 days   | 1.5x       |
| 7–13 days  | 2x         |
| 14+ days   | 3x         |

## Creature Stages

| Stage      | Points    |
|------------|-----------|
| Egg        | 0–99      |
| Hatchling  | 100–499   |
| Juvenile   | 500–1499  |
| Adult      | 1500–3999 |
| Legendary  | 4000+     |

## Archetypes

At Adult and Legendary stages, your coding style determines your pet's form:

| Archetype         | Trigger               | Icon |
|-------------------|-----------------------|------|
| Steady Streaker   | 7+ day push streak    | 🔥   |
| Hyperfocus Hacker | 50+ commits/month     | ⚡   |
| PR Wizard         | 8+ merged PRs/month   | 🔮   |
| Zen Coder         | Balanced activity      | 🌿   |

## Moods

Pet mood changes based on activity: Energized, Happy, Cozy, Focused, or Inspired.

## Achievements

14 milestones to unlock — commit counts, PR counts, streak lengths, and point thresholds.

## Badges

9 per-PR badges with bronze/silver/gold tiers, earned from individual PR stats:

| Category  | Bronze          | Silver          | Gold              |
|-----------|-----------------|-----------------|-------------------|
| Commits   | 10+ commits     | 50+ commits     | 100+ commits      |
| Reviews   | 3+ approvers    | 5+ approvers    | 10+ approvers     |
| Languages | 3+ repo langs   | 5+ repo langs   | 8+ repo langs     |

Run `node cli.js badges` to see your badge progress and fun stats (lines added/deleted, biggest PR, fastest merge, etc.).

## Generations

When your pet reaches Legendary, run `graduate` to retire it and start a new generation. The new pet inherits 10% of the parent's points. View your lineage with `lineage`.

## MCP Server

An MCP server is included for Claude Code integration. Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "tamago": {
      "command": "node",
      "args": ["/path/to/gitpet/mcp-server.js"]
    }
  }
}
```

Tools: `get_tamago`, `pet_tamago`, `tamago_advice`, `tamago_achievements`, `tamago_badges`

## Controls

- `q` or `Ctrl+C` — exit interactive mode
