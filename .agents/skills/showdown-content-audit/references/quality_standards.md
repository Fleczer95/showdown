# Showdown Content Quality Standards

This document defines the mandatory quality and legal criteria for all game content in Showdown.

## 1. Structural Standards

### The Ladder
- **Rungs**: Must have exactly 15 rungs in a full pack.
- **Rung Balance**: Each rung should ideally have a minimum of 20 questions (for base content) or 10 questions (for mini-packs).
- **Options**: Every question MUST have exactly 4 options.
- **Correct Index**: `correctIndex` must be between 0 and 3.
- **Difficulty**: Difficulty values must correspond to the rung (1-15).

### The Drop
- **Question Density**: Base pack should have at least 100 questions.
- **Options**: Every question MUST have exactly 4 options.
- **Correct Index**: `correctIndex` must be between 0 and 3.

### The Wheel
- **Puzzle Density**: Base pack should have at least 100 puzzles.
- **Phrase Case**: Phrases should be uppercase by default in the JSON/TS source for consistency.

### The Grid
- **Category Structure**: Each category MUST have exactly 5 clues.
- **Values**: Clues must follow the value progression: 100, 200, 300, 400, 500.

## 2. Linguistic Standards
- **Bilingual Parity**: Every piece of text MUST have an English (`en`) and Polish (`pl`) version.
- **Consistency**: Terminology should be consistent between languages.
- **Character Encoding**: Ensure UTF-8 encoding (especially for Polish characters like ą, ć, ę, ł, ń, ó, ś, ź, ż).

## 3. Intellectual Property (IP) Standards
- **Genericization**: Prefer generic terms over trademarked ones.
  - *Bad*: "The main character in Super Mario"
  - *Good*: "The famous Italian plumber in red overalls"
- **Risk Mitigation**: Avoid mentions of:
  - Big Tech (Apple, Google, Meta, etc.) unless specifically relevant to a technology category.
  - Entertainment Franchises (Disney, Marvel, Pokemon) unless described generically.
  - Specific brand names for common products (e.g., use "adhesive tape" instead of "Scotch Tape").

## 4. ID Conventions
- **Base Content**: `ladder-001`, `drop-001`, etc.
- **Packs**: `[slug]-[index]` (e.g., `science-001`).
