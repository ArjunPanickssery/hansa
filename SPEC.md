# Hansa: A Game of Comparative Advantage — Browser Rebuild Spec

## Project Overview

Rebuild "Hansa," an economics education game originally created by David D. Friedman and Tom Courtney (circa late 1980s–1990s, written in old Macintosh BASIC). The original is completely unrunnable today. This is a from-scratch rebuild as a single-page browser app (HTML/CSS/JS or React) that can be opened in Chrome. The game should be playable in a single browser tab with no backend needed.

The game is open source. Friedman's only condition: "code based on mine should remain open source."

## Source Materials

The authoritative design document is here — READ THIS FIRST, it is the complete game spec:
https://www.daviddfriedman.com/Living_Paper/Hansa/hansa_instructions/hansa_instructions.htm

Additional program descriptions (includes the Hansa entry plus related games like the Arbitrage game):
https://daviddfriedman.com/Living_Paper/Program_Descriptions/program_descriptions.htm

A partial modern reimplementation exists for reference:
https://github.com/rpmcruz/price-theory (see the wiki's Hansa page)

## What Hansa Is

Hansa is a **turn-based strategy game** modeled after "conquer the world" games (like Empire/Strategic Conquest), but instead of military conquest, you build a **trading league**. Cities join your league voluntarily when they see trade makes them better off. The game teaches **comparative advantage** — the core insight that trade benefits both parties even when one is better at producing everything.

## Core Game Mechanics (from Friedman's spec)

### Map
- A 2D map with terrain types: ocean, coastal, plains, mountains, forest, rivers
- Cities are placed on the map as dots/circles
- The map can be either a pre-drawn historical map (e.g., Napoleonic Europe, or a US map) OR randomly generated
- For the initial version, include at least one pre-drawn map and one random map generator

### Cities
Each city has:
- **Population** providing a fixed labor pool per turn
- **Production function**: labor → goods. Each good costs a certain amount of labor per unit. Costs differ across cities and are partly determined by surrounding terrain:
  - Coastal cities are good at producing fish
  - Cities near mountains are good at producing iron
  - Plains cities are good at producing wheat
  - Forest cities are good at producing wood/silk
- **Utility function**: represents total happiness from goods consumed. Identical across all cities. Diminishing marginal utility for each good (consuming more of one good gives less additional utility; consuming more of another good increases the marginal utility of the first). A standard Cobb-Douglas or CES utility function works.
- **Autarchy level**: the maximum utility a city can achieve on its own (no trade). This is a critical reference point — cities leave the league if their utility drops below this.

### Goods
The game should have 4 goods: **wheat, fish, iron, silk** (as in v0.8). Each city can produce some subset of these, with different labor costs per unit.

### Production
- Each turn, the player allocates each city's labor among the goods it can produce
- Interface: scroll bars or sliders for each good, showing units produced, labor used, and remaining labor
- The production window should show: quantity produced, quantity imported, quantity exported, quantity consumed, and current utility

### Trade
- Cities within a league can trade with each other
- **Transportation costs** depend on distance and terrain:
  - Water transport (ocean, river) is MUCH cheaper than land transport
  - Two coastal cities far apart are "closer" in transport cost than a coastal city and a nearby inland city
  - Transport labor is provided by the exporting city
- The player opens a **trade window** between two cities by clicking/dragging from one to the other
- In the trade window, the player adjusts how much of each good flows between the cities
- Goods cannot be stored between turns — consumption = production + imports - exports

### League Expansion
- The player can send **trade missions** from a member city to a non-member city
- Trade missions cost labor (more for distant cities)
- The probability a city accepts depends on how much utility gain the league's existing cities enjoy (weighted by proximity to the target city)
- The player can offer a **guaranteed utility level** to entice a city to join
- If a city's utility drops below autarchy, it may **secede** from the league
- If a city's utility drops below a guaranteed level, it is very likely to secede

### League Contraction
- Cities can leave if their utility falls below autarchy
- Cities can be poached by rival leagues (in multiplayer)

### Scoring
- Score = total utility gain above autarchy, summed over all cities and all turns
- Alternative: get all cities into your league as fast as possible

### Players
- 1-4 players (human or computer-controlled)
- In solitaire mode, all non-league cities are autarchic until invited
- In multiplayer mode, each player controls their own league
- **Computer player (AI)**: The original v0.8 had a computer player. Implement a simple AI that:
  - Allocates production to maximize utility
  - Seeks beneficial trades between its cities
  - Sends trade missions to nearby promising cities

### Fog of War (planned for original but never fully implemented)
- At game start, the player sees only their own cities plus terrain within a fixed radius
- Trade missions reveal terrain along their route
- New cities joining the league reveal nearby terrain
- This is a nice-to-have for v2, not required for initial version

## Key Economic Lessons the Game Should Teach

1. **Comparative advantage**: It pays to ship a good FROM city A TO city B even if city B can produce that good more cheaply — what matters is relative costs, not absolute costs. The player should discover this naturally through gameplay.

2. **Optimal production**: Given a production function with multiple outputs, the correct allocation is where marginal product is proportional to price (i.e., equalize the marginal utility per unit of labor across all goods).

3. **Gains from trade**: Both trading partners benefit. The league structure enforces this — you can't exploit cities because they'll leave.

4. **Transport geography**: Water routes are vastly cheaper than land routes. Rivers matter enormously. This shapes which cities are natural trading partners.

## Technical Implementation

### Stack
- Single HTML file with embedded CSS and JS, OR a React app (your choice — React is probably better for the UI complexity)
- No backend, no database — all state in memory
- Canvas or SVG for the map rendering
- Should work in modern Chrome

### Architecture Suggestion
```
src/
  models/
    City.js          — city state: population, labor, production costs, utility
    League.js        — collection of cities, scoring
    Map.js           — terrain grid, city placement, distance/transport costs
    TradeRoute.js    — trade between two cities, transport costs
    Game.js          — turn management, player management, game state
  ai/
    ComputerPlayer.js — simple AI for computer-controlled leagues
  ui/
    MapView.js       — render the map, cities, league colors, terrain
    ProductionPanel.js — per-city production allocation UI
    TradePanel.js    — trade window between two cities
    ScorePanel.js    — current scores, utility levels
    GameControls.js  — new game, end turn, save/load
  utils/
    terrain.js       — terrain generation, cost tables
    economics.js     — utility functions, optimal allocation helpers
```

### Map Rendering
- Hex grid or square grid, ~40x30 cells minimum
- Terrain colors: blue (ocean), light blue (coastal/river), green (plains), dark green (forest), gray (mountains)
- Cities as colored circles (color = league ownership, white = unaffiliated)
- Show trade routes as lines between cities when active

### UI Flow
1. **New Game screen**: Choose map (historical or random), number of players, which are human/computer
2. **Main map view**: Shows the world, your cities (highlighted), other league cities (different colors), unaffiliated cities (white/neutral)
3. **Double-click a city** → opens Production Panel for that city
4. **Click-drag from one city to another** → opens Trade Panel between them
5. **Click-drag from your city to a non-member city** → shows trade mission cost, option to send mission with optional utility guarantee
6. **"End Turn" button** → finalizes all production/trade, calculates scores, resolves missions (accept/reject), checks for secession, advances to next player's turn
7. **Score display** → running total per player, utility bars per city

### Production Panel (per city)
- City name, population, total labor
- For each good the city can produce:
  - Label showing labor cost per unit (e.g., "⚒ 2 labor/unit")
  - Slider: units to produce (0 to max given available labor)
  - Display: produced / imported / exported / consumed
- Utility bar showing current utility vs. autarchy level vs. guaranteed level (if any)
- Remaining unused labor

### Trade Panel (between two cities)
- Shows both cities side by side
- For each good: slider to adjust flow (export from city A ↔ export from city B)
- Shows transport cost in labor for current trade allocation
- Shows utility for both cities updating in real-time as trade is adjusted
- Both cities' autarchy levels shown for reference

### Mathematical Details

**Utility function** (same for all cities):
Use Cobb-Douglas: U = product(x_i^alpha_i) where x_i is consumption of good i and alpha_i are weights (e.g., all equal to 0.25 for 4 goods). Or use U = sum(alpha_i * ln(x_i)) which is equivalent and easier to compute. Ensure U(0) is handled gracefully (use small epsilon floor).

**Production**: Linear. Each city has a labor cost c_i for good i. Producing q_i units costs c_i * q_i labor. Total labor used ≤ city's labor supply L.

**Transport cost**: Moving one unit of good from city A to city B costs t(A,B) labor, provided by the exporting city. t(A,B) depends on the path between A and B:
- Ocean tile: cost 1
- River tile: cost 2  
- Plains tile: cost 5
- Forest tile: cost 8
- Mountain tile: cost 15
- Use shortest-path (Dijkstra) between cities through the terrain grid

**Autarchy calculation**: For each city, solve: maximize U(x_1, ..., x_n) subject to sum(c_i * x_i) ≤ L. With log utility, the solution is x_i = (alpha_i / c_i) * L / sum(alpha_j) — allocate labor proportional to utility weights divided by cost.

**Trade mission acceptance probability**: P(accept) = sigmoid(k * (avg_utility_gain_of_nearby_league_cities - threshold)). Start with k=0.5, threshold=2. Adjust for fun gameplay.

**Secession probability**: If city utility < autarchy: P(secede) = min(1, (autarchy - utility) / autarchy * scale_factor). If utility < guaranteed level, use a higher scale factor.

### Pre-drawn Maps
Include at least:
1. **Napoleonic Europe** (as in original): ~15-20 cities including Amsterdam, Antwerp, London, Paris, Hamburg, Venice, Constantinople, etc. Ocean around coasts, rivers (Rhine, Danube), mountains (Alps, Pyrenees).
2. **Simple tutorial map**: 4-6 cities on a small map to learn the mechanics.

### Random Map Generation
- Generate terrain using Perlin noise or similar
- Place cities at reasonable locations (not in ocean, prefer coastal/river adjacency)
- Ensure each city has production costs influenced by surrounding terrain
- Ensure the map is playable (cities are reachable, reasonable distribution)

### Save/Load
- Serialize game state to JSON
- Save to localStorage or offer as file download
- Load from localStorage or file upload

### Quality of Life Features
- **Tooltip on hover over city**: show city name, league, utility, top goods
- **Minimap** or zoom/pan on main map
- **Trade route visualization**: lines on map showing active trade flows, thickness proportional to volume
- **City utility bars** visible on the map (small bars under each city dot)
- **Turn history**: log of what happened each turn (missions sent, cities joined/left, scores)
- **Tutorial/help panel**: explain comparative advantage, how to play, what the numbers mean — pull from Friedman's instructional text

## Implementation Phases

### Phase 1: Core Engine (get the math working)
- City model with production functions
- Utility calculation
- Autarchy level calculation  
- Trade between two cities with transport costs
- Map with terrain and pathfinding

### Phase 2: Single-Player Playable Game
- Map rendering (start with the tutorial map)
- Production panel UI
- Trade panel UI
- Turn system
- League expansion (trade missions)
- Scoring

### Phase 3: Polish & AI
- Computer player AI
- Random map generation
- Historical map (Napoleonic Europe)
- Save/load
- Visual polish, tooltips, trade route lines
- Tutorial/help text

### Phase 4: Multiplayer & Advanced
- Multi-human-player support (hot seat)
- Fog of war
- More maps
- Difficulty levels (AI aggressiveness)

## Important Notes

- **The game should be FUN.** It's an educational game, but it teaches through gameplay, not lectures. The player should discover comparative advantage by noticing that counter-intuitive trades increase their score.
- **Keep the UI clean.** The original had Mac-era scroll bars and tiny windows. A modern version should have clear, readable panels with good visual hierarchy.
- **Real-time feedback**: When the player adjusts production or trade sliders, utility numbers should update instantly so they can see the effect.
- **Start simple**: Get 2 cities trading 2 goods working first, then scale up.
- **The autarchy line is key UX**: Always show it prominently — it's the player's reference for whether trade is helping.
- **License**: Open source (as per Friedman's original terms).