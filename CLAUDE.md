# Fantasy Baseball War Room

## League Strategy Principles

These are the core rules that govern every feature, recommendation, and analysis in the app. All code must respect these principles.

### Matchup Structure
- Matchups are one week long (Monday to Sunday)
- Lineups are set daily, not weekly. Every recommendation should be daily-actionable.
- We will almost always use all allowed weekly moves (adds/drops)

### Roster Construction
- Minimal position player bench. Bench bats do not score points and create decision paralysis. Roster spots are better used on streaming pitchers.
- Punt saves. Saves have the lowest correlation to winning in our league (weight: 0.002). The closer roster spot is better used for a streaming SP or extra starter.
- Target high-impact positions when evaluating pickups or trades. Not all roster spots are equal.

### Pitching Strategy
- Stream SPs aggressively. More starts and innings are worth the risk of ERA/WHIP spikes or losses.
- Never recommend "sit a pitcher to protect ratios" unless the matchup is already locked.
- Always track probable starters for both the current week AND the following week. Next week's double-starters are pickup targets today.
- Double-starters are the highest-priority streaming targets.
- Pitcher volume drives the categories that matter most: K, QS, W.

### Category Weights (from league history correlation analysis)
These weights reflect Spearman rank correlation between per-category win% and overall team win%. They drive z-score and FAR calculations.

**High impact (>0.09):** TB (0.114), HR (0.108), R (0.100), RBI (0.099)
**Medium impact (0.06-0.08):** H (0.083), W (0.072), K (0.070), WHIP (0.062), QS (0.060), ERA (0.057)
**Low impact (0.03-0.05):** SB (0.046), BB (0.035), AVG (0.034), L (0.033)
**Punt (<0.01):** HD (0.025), SV (0.002)

We drafted based on these weights and every in-season decision should follow them. A player who contributes to TB/HR/R/RBI is more valuable than one who contributes to SV/HD/AVG.

### Decision Framework
- When recommending FA pickups: rank by contribution to high-weight categories, not overall FAR alone
- When evaluating trades: surplus in punt categories (SV, HD) has near-zero value. Surplus in power categories (TB, HR, R, RBI) is real trade capital.
- When presenting "categories at risk" in a matchup: weight the display by category importance. Losing saves matters less than losing strikeouts.

## Code Guidelines
- Sanitize for edge cases: Infinity, NaN, null, division by zero in frontend code
- Confirm tie-handling rules before implementing ranking/scoring logic
- ESPN API data is unreliable: always sanitize numeric values before display
- Never use emdashes or double-dashes in output
- Always sign off commits: `git commit -s`
