# commitchi

An idle CLI pet that grows from your GitHub activity. Like a Tamagotchi in your terminal — always animated, always cozy, no negatives.

## Quick Start

```bash
node cli.js
```

On first run, you'll be prompted for a GitHub Personal Access Token.

### Create a token

1. Go to https://github.com/settings/tokens
2. Generate a **classic** token with scopes: `read:user`, `repo` (for private repos)
3. Paste it when prompted

Your token is stored locally in `~/.commitchi.json` — nothing leaves your machine.

## How it works

- Fetches your merged PRs, commits, and push streak from the last 30 days
- Calculates points: `(PRs × 100 + commits × 10) × streak_multiplier`
- Your ASCII creature evolves through 5 stages
- Stats cache for 15 minutes, then auto-refresh

## Scoring

| Streak     | Multiplier |
|------------|------------|
| 0–2 days   | 1×         |
| 3–6 days   | 1.5×       |
| 7–13 days  | 2×         |
| 14+ days   | 3×         |

## Creature Stages

| Stage      | Points    |
|------------|-----------|
| Egg        | 0–99      |
| Hatchling  | 100–499   |
| Juvenile   | 500–1499  |
| Adult      | 1500–3999 |
| Legendary  | 4000+     |

## Controls

- `q` or `Ctrl+C` — exit

## npx

```bash
npx commitchi
```
