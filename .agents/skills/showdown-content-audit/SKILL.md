---
name: showdown-content-audit
description: Specialized skill for auditing Showdown game content quality, translation parity, structural integrity, and Intellectual Property (IP) risks. Use when reviewing new or expanded game packs, checking for duplicates, or verifying content before release.
---

# Showdown Content Audit

This skill provides a systematic workflow for ensuring all game content (Ladder questions, Drop prompts, Wheel puzzles, Grid clues) meets high quality and technical standards.

## Audit Workflow

### 1. Automated Quality Check
Run the `audit_engine.cjs` script to detect technical issues across game files.
It validates:
- **Internal Duplicates**: Identical questions, phrases, or clues within a single pack (case-insensitive).
- **Structural Integrity**: Expected number of options (4), valid correct indices (0-3), and correct number of clues in Grid categories (5).
- **Translation Parity**: Ensures every English string has a Polish translation and vice-versa.
- **IP Risk Flags**: Detection of trademarked terms (e.g., Disney, Marvel, Apple) using word-boundary matching.
- **Quality Checks**: Flags questions that are over-simple ("toddler-level") or ambiguous (vague descriptors like "small and yellow").

**How to run:**
```bash
# Audit a JSON pack
node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs assets/packs/ladder/world-capitals.json

# Audit a hardcoded TS content file
node .agents/skills/showdown-content-audit/scripts/audit_engine.cjs src/game/ladder/content.ts
```

### 2. Manual IP & Genericization Review
Review all flagged items against the [Quality Standards](references/quality_standards.md).
- **Rule**: Genericize by default.
- Prefer "The famous wizard boy" over "Harry Potter".
- Escalation: If a trademarked term is necessary for a specific "Brand" category, ensure it meets fair use criteria.

### 3. Density & Rung Audit
For "The Ladder", verify that each rung has enough variety. Base content should aim for 20+ questions per rung to ensure high replayability.

### 4. ID Convention Verification
Verify that IDs follow the established convention:
- Base: `ladder-XXX`, `drop-XXX`.
- Packs: `[slug]-XXX`.

## Quality Reference
See [quality_standards.md](references/quality_standards.md) for the complete list of mandatory criteria.
