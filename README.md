# Dawnfall Protocol

An original 1–4 player browser survival roguelite prototype inspired by the active aiming, ammunition, character–weapon pairing, buildcraft, and boss power spikes that distinguish *20 Minutes Till Dawn*.

## Playtest loop

- Move with WASD and aim/fire with the mouse.
- Choose one of four hunters and three weapons.
- Collect shared experience; hunters rotate who chooses the squad's next perk.
- Revive downed teammates with E before their fifteen-second bleedout ends.
- Use the Moonwell, Ward Tower, and Ritual Stone to regroup.
- Defeat the Tollkeeper to awaken every hunter's base ability.
- Select a compressed four-minute field test or the intended twenty-minute run.

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

