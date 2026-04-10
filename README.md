# Hansa: A Game of Comparative Advantage

A browser-based rebuild of **Hansa**, an economics education game originally created by **David D. Friedman** (ddfr@daviddfriedman.com) and **Tom Courtney** in the late 1980s-90s. The original was written in old Macintosh BASIC and is no longer runnable. This is a from-scratch reimplementation as a single-page web app.

**[Play the game](https://arjunpanickssery.github.io/hansa/)**

Friedman's original game instructions and design document:
http://www.daviddfriedman.com/Living_Paper/Hansa/hansa_instructions/hansa_instructions.htm

## What is Hansa?

Hansa is a turn-based strategy game modeled after "conquer the world" games, but instead of military conquest, you build a **trading league**. Cities join your league voluntarily when they see that trade makes them better off. The game teaches **comparative advantage** -- the core insight that trade benefits both parties even when one is better at producing everything.

## Rules

### Cities and Production

Each city has a population that provides a fixed labor pool each turn. Labor is allocated among four goods -- **wheat, fish, iron, and silk** -- each with a different production cost per unit. Costs are determined by geography: coastal cities produce fish cheaply, mountain cities produce iron cheaply, plains cities produce wheat cheaply, and forest cities produce silk cheaply.

### Trade

Cities within your league can trade with each other. Transportation costs depend on the terrain between cities -- water transport (ocean, rivers) is much cheaper than overland routes through plains, forests, or mountains. The exporting city pays the transport labor cost. Goods cannot be stored between turns.

### Utility and Autarchy

Each city's welfare is measured by a utility function (log Cobb-Douglas) over the goods it consumes. The **autarchy level** is the maximum utility a city can achieve on its own with no trade. This is the critical reference point -- if a city's utility drops below autarchy, it may leave your league.

### League Expansion

You expand your league by sending **trade missions** from your cities to unaffiliated cities. Missions cost labor. The probability a city accepts depends on how much your nearby league cities are prospering from trade. You can't force cities to join -- you have to demonstrate that trade is beneficial.

### Secession

Cities that find themselves worse off than they would be alone will leave your league. You can't exploit cities because they'll simply walk away.

### Scoring

Your score is the total utility gain above autarchy, summed over all your cities and all turns. The goal: build the most prosperous trading league.

### The Key Insight

The game is designed so that players naturally discover **comparative advantage**: it pays to ship a good FROM city A TO city B even if city B can produce that good more cheaply. What matters is relative costs, not absolute costs. A city that's bad at everything still has something valuable to trade.

## Running Locally

```
npm install
npm run dev
```

## Tests

```
npm test
```

## License

Open source, per Friedman's original terms: "code based on mine should remain open source."
