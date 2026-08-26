# Dawnfall Protocol

An original 1–4 player browser survival roguelite prototype inspired by the active aiming, ammunition, character–weapon pairing, buildcraft, and boss power spikes that distinguish *20 Minutes Till Dawn*.

## Playtest loop

- Move with WASD and mouse on desktop, or two analog sticks on mobile; every hunter shares one ability control.
- Choose one of twelve hunters, ten weapons, four difficulty levels, and three battlefields—or randomize the loadout and map.
- Fill one shared squad XP track, then let every active hunter choose simultaneously from three personal upgrades with three rerolls.
- Shape individual builds from 24 one-rank common transformations plus five signature upgrades for every hunter, including a unique combat companion.
- Revive downed teammates with E during a generous twenty-four-second rescue window; multiple rescuers combine their effort. Solo hunters and the last surviving hunter skip unwinnable bleedout waits.
- If you are eliminated while allies remain, cycle between them with Q/E or the spectator controls.
- Fight across the open Gloamreach Moor, the volcanic Emberfall Ruins, or the nine-room Reliquary dungeon.
- Use three map-specific structures to generate heart crystals, fire on enemies, or accelerate your weapon.
- Read damage in half-heart units: every hunter begins with five hearts, Bastion begins with a sixth, and maximum-heart upgrades expand each personal build.
- Regenerate one heart every minute or collect a one-heart crystal that forms at each healing structure on its own visible sixty-second charge ring.
- In the Reliquary, players, enemies, companions, and projectiles collide with solid walls while monsters navigate through room doors.
- Fight eight regular enemy archetypes and eight dynamic bosses with telegraphed attacks and exposed weak points; seven arrive before the empowered final trio, and every boss grants a squad-wide relic while ordinary upgrades stay personal.
- Select a compressed four-minute field test or the intended twenty-minute run.

## Art direction

The interface uses original painterly dark-fantasy illustration, while combat uses a projected three-quarter action-RPG view. Hunters are compact, code-authored models with unique proportions, hair masses, costumes, walking strides, idle breathing, recoil, ability motion, and upright aim-facing; enemies retain harder-edged atlas art so a crowded field remains readable. The production-ready WebP art lives in `public/art`, with full generated originals preserved in `art-source`.

Every upgrade draft also reveals one of five alternate-life character scenes and one of fifty stable first-person personality details for the chosen hunter. Full-resolution landscape backdrops fill the screen behind translucent choices, and a corner control hides the draft UI for an unobstructed splash-art view while keeping the character detail readable.

## Multiplayer model

The host runs the authoritative simulation and sends compact state snapshots to up to three guests through PeerJS/WebRTC. GitHub Pages only hosts the static client; PeerJS Cloud brokers the initial connection and gameplay traffic then travels over WebRTC data channels.

Co-op deliberately applies pressure in several ways: larger and faster waves, tougher enemies, denser boss volleys, shorter boss ability cycles, and extra reinforcements. Hunters separated from every ally for several seconds are marked, pursued faster, and take an extra half-heart per hit. Staying together avoids that penalty, shared crystals naturally go to the most wounded nearby hunter, and coordinated revivers stack their rescue speed. Ally-only upgrades are removed from solo drafts.

Because the free broker uses STUN rather than a dedicated TURN relay, some strict corporate, military, school, or symmetric-NAT networks may block a connection. Home networks and ordinary mobile hotspots are the primary playtest target.

## Local development

```bash
npm install
npm run dev
```

Validation:

```bash
npm test
npm run build
npm run test:smoke
```

## Deployment

The Pages workflow reads `VITE_BASE` from a GitHub Actions variable. For a repository named `dawnfall-protocol`, set it to `/dawnfall-protocol/` before the first push.

## Attribution

Research reference: *20 Minutes Till Dawn* by flanne. Dawnfall Protocol is not affiliated with flanne. All names, code, mechanics implementation, balancing, visual design, characters, enemies, and abilities in this repository are original to this prototype.
