# Dawnfall Protocol

An original 1–4 player browser survival roguelite prototype inspired by the active aiming, ammunition, character–weapon pairing, buildcraft, and boss power spikes that distinguish *20 Minutes Till Dawn*.

## Playtest loop

- Move with WASD and aim/fire with the mouse.
- Choose one of eight hunters and three weapons.
- Collect personal experience and shape an individual build from 24 common perks plus four signature upgrades for every hunter.
- Revive downed teammates with E before their fifteen-second bleedout ends.
- If you are eliminated while allies remain, cycle between them with Q/E or the spectator controls.
- Use the Moonwell, Ward Tower, and Ritual Stone to regroup.
- Fight eight regular enemy archetypes and four scheduled bosses; each boss grants a squad-wide relic while every ordinary upgrade stays personal.
- Select a compressed four-minute field test or the intended twenty-minute run.

## Art direction

The interface uses original painterly dark-fantasy illustration, while the battlefield deliberately switches to crisp, limited-palette pixel art so static sprites remain readable in motion. Characters, creatures, bosses, and interactive structures share hard-edged runtime atlases. Every moving model uses a centered sprite authored facing east—the canvas angle-zero direction. Right-facing angles rotate normally; left-facing angles fold back into an upright range and mirror the sprite, keeping every model right-side-up without breaking its aim vector. Lightweight bob, stride, and recoil transforms add motion without requiring large animation sheets. The production-ready WebP atlases live in `public/art`; shared colors and silhouettes keep the illustrated menus and pixel-art combat grounded in one world.

## Multiplayer model

The host runs the authoritative simulation and sends compact state snapshots to up to three guests through PeerJS/WebRTC. GitHub Pages only hosts the static client; PeerJS Cloud brokers the initial connection and gameplay traffic then travels over WebRTC data channels.

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
