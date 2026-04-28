# GM Advice

Fetch live Fantasy Baseball data and generate a harsh, data-driven GM analysis. Write it to the static JSON file and push so the roster page updates.

## Steps

### 1. Fetch data

Use WebFetch to retrieve all of the following in parallel:

- https://baseball.lukeinglis.me/api/espn/matchup
- https://baseball.lukeinglis.me/api/espn/league-stats?scope=season
- https://baseball.lukeinglis.me/api/espn/standings
- https://baseball.lukeinglis.me/api/espn/schedule

### 2. Analyze and generate advice

Review all the data. Produce three sections:

**week** (3-4 bullets) — Specific tactical advice for this week's matchup:
- Which categories to attack (closest to flipping, with actual gap sizes)
- Which categories to protect (thin leads)
- Streaming/start decisions based on remaining days and schedule
- Any injury risks that change the picture

**month** (4-5 bullets) — Roster construction for the next 30 days:
- Players to drop (underperforming vs their cost/slot, name them and quote their stats)
- Free agent targets (based on category weaknesses from the season rankings)
- Trade opportunities (sell-high candidates, positional surplus)
- Injury situations to monitor

**season** (4-5 bullets) — What must happen to win the championship:
- Category gaps vs top teams (be specific about rank and deficit)
- Positional construction problems
- The one or two trades that would change the trajectory
- Realistic playoff path given current standing and schedule

**Tone:** Brutally honest. No sugarcoating. Name specific players. Quote their exact stats. Start every bullet with an action verb.

### 3. Write the file

Write the result to `web/public/gm-advice.json`:

```json
{
  "week": ["bullet 1", "bullet 2", "bullet 3"],
  "month": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "season": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "generatedAt": "<current ISO timestamp>"
}
```

### 4. Commit and push

```
git add web/public/gm-advice.json
git commit -s -m "Update GM advice"
git push origin main
```
