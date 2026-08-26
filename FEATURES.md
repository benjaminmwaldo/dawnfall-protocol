# Dawnfall Protocol — Playtest Feature Checklist

This is the cumulative implementation checklist for playtest feedback. New requests should be added here before a release is deployed.

## Core run

- [x] One-to-four-player survival run with active aiming, firing, ammunition, and reloads
- [x] Four-minute field test and twenty-minute full night
- [x] Victory requires defeating the final three-boss encounter, including overtime
- [x] Spectate living allies after elimination
- [x] Immediate defeat instead of an unwinnable bleedout in solo or when no rescuer remains

## Hunters, weapons, and builds

- [x] Nine distinct hunters with character-specific abilities, awakenings, perks, bodies, faces, portraits, and pixel sprites
- [x] Add Rapsy as a ninth hunter with very long brown hair, a slender cute silhouette, and a circular hair-slash ability
- [x] Give every hunter a shared active-ability control with a visible cooldown and consistent keyboard/touch input behavior
- [x] Add tasteful COMING SOON hunter slots for future additions
- [x] Keep Scarlet progressive but make her politics subtler and balanced with ordinary city life, being single, and occasional fights with her dad
- [x] Ten distinct weapons, including Dawncleaver, plus weapon-specific perks
- [x] Random hunter, weapon, and map choices
- [x] Shared squad XP and synchronized upgrade pauses; every active hunter makes a personal choice before combat resumes
- [x] Three upgrade choices, three personal rerolls, a half-second input lock, rare high-impact upgrades, and combat pets
- [x] Solo drafts exclude ally-only upgrades such as Sanctuary, Merciful Hand, and Last Rite

## Hearts, healing, and revives

- [x] Player health uses minimalist hearts at the screen edge, never floating above player models
- [x] Five-heart baseline; Bastion starts with a sixth heart
- [x] Enemy damage is quantized to half-heart packets; common enemies deal half a heart and heavy enemies deal more
- [x] Every living hunter regenerates one heart every sixty seconds with a visible personal timer ring
- [x] Healing structures charge one shared one-heart crystal every sixty seconds with a visible world-space ring
- [x] Twenty-four-second multiplayer rescue window with faster combined progress from multiple revivers
- [x] Brief post-hit invulnerability that cannot combine too strongly with lifesteal
- [x] Reduce passive lifesteal and on-kill healing to a much weaker sustain tool
- [x] Nerf Combustion’s burn ticks and chained death explosions

## Co-op pressure

- [x] Host-authoritative compact snapshots and synchronized map/start state
- [x] Multiplayer increases wave density, enemy health, movement speed, boss cadence, boss volley density, and reinforcements
- [x] Hunters separated from allies are visibly marked, pursued faster, and take an extra half-heart per hit
- [x] Shared heart crystals prioritize the most wounded nearby hunter
- [x] Multiple teammates can combine revive speed

## Enemies, bosses, and maps

- [x] Eight ambient enemy archetypes with off-screen spawning and slower, larger enemy bullets
- [x] Expand to eight dynamic bosses with distinct massive dashes, colored heavy bullets, giant laser lanes, and elite summons
- [x] Repair the Graveknight silhouette so her sword blade is never visibly cut off
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
- [x] Rewrite all fifty personality details per hunter in first person and ensure every displayed detail begins with “I”
- [x] Remove world-space player hearts and keep health only at the screen edge
- [x] Simplify the gameplay HUD and selection interface into a cleaner, more minimalist hierarchy
- [x] Replace awkward portrait-sized upgrade backgrounds with full-screen splash compositions and right-weighted character framing
- [x] Replace chibi gameplay hunters with slimmer top-down pixel silhouettes closer to the enemy rendering language
- [x] Replace overly detailed gameplay weapons with smaller, simpler pixel silhouettes that never cover the hunter
- [x] Align Rapsy's selection portrait with the gothic hunter-card art direction and consistently redesign all five splash scenes around the same petite English identity

## Work-notes expansion

- [x] Rename Rapunsel to Rapsy everywhere visible and remove “adult” from her description
- [x] Shift live combat to a projected three-quarter action-RPG view with an original stylized fantasy rendering language
- [x] Give hunters readable idle, walking, aiming, recoil, hair, and ability motion instead of frozen in-game sprites
- [x] Add mobile twin-stick gameplay: left stick moves, right stick aims and fires, plus accessible ability/interact buttons
- [x] Add more fully playable hunters with distinct silhouettes, faces, backgrounds, abilities, signature perks, and personality facts
- [x] Add selectable difficulty levels with clearly explained mechanical modifiers and synchronized multiplayer selection
- [x] Replace “SPACE” wording on character-selection cards with device-neutral “SPECIAL” or “ABILITY” language
- [x] Make the cast less visually homogeneous by grounding each hunter in a specific original face, build, age, cultural background, silhouette, and styling brief
- [x] Build a reusable face-first character-design skill that produces six visual options, supports selection-led iterations, then repeats the loop for body design until approval
- [x] Establish the world as a dystopian post-collapse apocalypse and weave lore into hunters, enemies, bosses, maps, and an explorable world-files interface
- [x] Rename Warden and redesign her identity, presentation, and voice around a clearly Japanese heroine
- [x] Make boss encounters more mechanically distinct with exposed weak points, readable warning zones, and damage telegraphs before major attacks
