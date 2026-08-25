# Dawnfall Protocol — Playtest Feature Checklist

This is the cumulative implementation checklist for playtest feedback. New requests should be added here before a release is deployed.

## Core run

- [x] One-to-four-player survival run with active aiming, firing, ammunition, and reloads
- [x] Four-minute field test and twenty-minute full night
- [x] Victory requires defeating the final three-boss encounter, including overtime
- [x] Spectate living allies after elimination
- [x] Immediate defeat instead of an unwinnable bleedout in solo or when no rescuer remains

## Hunters, weapons, and builds

- [x] Eight distinct hunters with character-specific abilities, awakenings, perks, bodies, faces, portraits, and pixel sprites
- [x] Scarlet is the fire hunter and has an explicitly progressive, human-rights- and climate-justice-focused personality
- [x] Ten distinct weapons, including Dawncleaver, plus weapon-specific perks
- [x] Random hunter, weapon, and map choices
- [x] Shared squad XP and synchronized upgrade pauses; every active hunter makes a personal choice before combat resumes
- [x] Three upgrade choices, three personal rerolls, a half-second input lock, rare high-impact upgrades, and combat pets
- [x] Solo drafts exclude ally-only upgrades such as Sanctuary, Merciful Hand, and Last Rite

## Hearts, healing, and revives

- [x] Player health uses hearts instead of bars in the HUD and above player models
- [x] Five-heart baseline; Bastion starts with a sixth heart
- [x] Enemy damage is quantized to half-heart packets; common enemies deal half a heart and heavy enemies deal more
- [x] Every living hunter regenerates one heart every sixty seconds with a visible personal timer ring
- [x] Healing structures charge one shared one-heart crystal every sixty seconds with a visible world-space ring
- [x] Twenty-four-second multiplayer rescue window with faster combined progress from multiple revivers
- [x] Brief post-hit invulnerability that cannot combine too strongly with lifesteal

## Co-op pressure

- [x] Host-authoritative compact snapshots and synchronized map/start state
- [x] Multiplayer increases wave density, enemy health, movement speed, boss cadence, boss volley density, and reinforcements
- [x] Hunters separated from allies are visibly marked, pursued faster, and take an extra half-heart per hit
- [x] Shared heart crystals prioritize the most wounded nearby hunter
- [x] Multiple teammates can combine revive speed

## Enemies, bosses, and maps

- [x] Eight ambient enemy archetypes with off-screen spawning and slower, larger enemy bullets
- [x] Four dynamic bosses with distinct dashes, barrages, movement, and summons
- [x] Empowered Dawnless Triumvirate finale
- [x] Gloamreach Moor, Emberfall Ruins, and the nine-room Reliquary dungeon
- [x] Map-specific terrain, structures, healing crystals, turrets, and fire-rate shrines
- [x] Solid dungeon walls block hunters, monsters, companions, and projectiles; monsters route through doors

## Art and interface

- [x] Painterly fantasy interface art and deliberately simpler top-down pixel gameplay art
- [x] Upright mirrored hunter sprites that track aim without rotating upside-down
- [x] Small gameplay-scale hunter sprites with separately aligned, proportionate weapon sprites
- [x] Five alternate upgrade portraits per hunter, plus five victory and five defeat scenes
- [x] Fifty personality details per hunter, selected consistently per upgrade level
- [x] Brighter translucent upgrade UI and a full-art mode that hides choice UI but preserves the readable personality detail
- [x] Native-aspect upgrade portraits that avoid blurry cover-style stretching
- [x] Desktop and phone-responsive layouts
