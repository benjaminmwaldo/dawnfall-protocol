import './style.css'
import { BOSS_NAMES, CHARACTERS, PLAYER_COLORS, UPGRADES, WEAPONS, characterById, isBoss, teamBuffById, upgradeById, weaponById } from './game/data'
import { GameEngine } from './game/engine'
import { GameRenderer } from './game/renderer'
import type { BossType, GameSnapshot, InputState, PlayerConfig } from './game/types'
import { MultiplayerSession } from './network'

type Screen = 'home' | 'lobby' | 'game' | 'recap'
type SessionMode = 'solo' | 'host' | 'guest'

const app = document.querySelector<HTMLDivElement>('#app') as HTMLDivElement
if (!app) throw new Error('App shell was not found.')

const makePlayerId = () => crypto.randomUUID().slice(0, 8)
const escapeHtml = (text: string) => text.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character)
const formatTime = (seconds: number) => {
  const absolute = Math.max(0, Math.floor(Math.abs(seconds)))
  return `${seconds < 0 ? '+' : ''}${Math.floor(absolute / 60).toString().padStart(2, '0')}:${(absolute % 60).toString().padStart(2, '0')}`
}
const FINAL_TRIO_TYPES: BossType[] = ['broodmother', 'graveknight', 'eclipse-eye']
const ART_BASE = `${import.meta.env.BASE_URL}art/`
const CHARACTER_ART_INDEX: Record<PlayerConfig['character'], number> = { vesper: 0, cinder: 1, bastion: 2, warden: 3, nyx: 4, tempest: 5, briar: 6, seraph: 7 }
const COMPANION_ART_INDEX: Partial<Record<string, number>> = { gravewing: 0, ashkit: 1, 'aegis-hound': 2, 'mercy-moth': 3, shadecat: 4, 'storm-wisp': 5, thornling: 6, sunbird: 7 }
const WEAPON_ART: Record<PlayerConfig['weapon'], { file: string; columns: number; rows: number; index: number }> = {
  revolver: { file: 'armory-atlas.webp', columns: 3, rows: 2, index: 0 },
  scattergun: { file: 'armory-atlas.webp', columns: 3, rows: 2, index: 1 },
  'arc-rifle': { file: 'armory-atlas.webp', columns: 3, rows: 2, index: 2 },
  'burst-carbine': { file: 'armory-atlas-v2.webp', columns: 3, rows: 2, index: 0 },
  railgun: { file: 'armory-atlas-v2.webp', columns: 3, rows: 2, index: 1 },
  'grenade-launcher': { file: 'armory-atlas-v2.webp', columns: 3, rows: 2, index: 2 },
  flamethrower: { file: 'armory-atlas-v2.webp', columns: 3, rows: 2, index: 3 },
  'frost-cannon': { file: 'armory-atlas-v2.webp', columns: 3, rows: 2, index: 4 },
  seeker: { file: 'armory-atlas-v2.webp', columns: 3, rows: 2, index: 5 },
  sword: { file: 'sword-dawncleaver.webp', columns: 1, rows: 1, index: 0 },
}
const atlasStyle = (file: string, columns: number, rows: number, index: number) => {
  const column = index % columns
  const row = Math.floor(index / columns)
  const x = columns === 1 ? 0 : (column / (columns - 1)) * 100
  const y = rows === 1 ? 0 : (row / (rows - 1)) * 100
  return `background-image:url('${ART_BASE}${file}');background-size:${columns * 100}% ${rows * 100}%;background-position:${x}% ${y}%;`
}
const portraitStyle = (character: PlayerConfig['character']) => atlasStyle('hunter-portraits-v2.webp', 4, 2, CHARACTER_ART_INDEX[character])
const weaponArtStyle = (weapon: PlayerConfig['weapon']) => {
  const art = WEAPON_ART[weapon]
  return atlasStyle(art.file, art.columns, art.rows, art.index)
}
const perkArtStyle = (perkId: string) => atlasStyle('perk-atlas.webp', 4, 3, Math.max(0, UPGRADES.slice(0, 12).findIndex((perk) => perk.id === perkId)))
const perkIconMarkup = (perkId: string, className: string, tag: 'span' | 'i' = 'span', badge?: number) => {
  const upgrade = upgradeById(perkId)
  const companionIndex = COMPANION_ART_INDEX[perkId]
  const paintedPerk = UPGRADES.slice(0, 12).some((perk) => perk.id === perkId)
  const painted = paintedPerk || companionIndex !== undefined
  const paintedStyle = companionIndex !== undefined ? atlasStyle('companion-sprites-v1.webp', 4, 2, companionIndex) : perkArtStyle(perkId)
  return `<${tag} class="${className}${painted ? '' : ' glyph-icon'}" style="${painted ? paintedStyle : `--accent:${upgrade.accent}`}" aria-hidden="true">${painted ? '' : upgrade.icon}${badge ? `<b>${badge}</b>` : ''}</${tag}>`
}

document.documentElement.style.setProperty('--hero-art', `url('${ART_BASE}hero-night.webp')`)
document.documentElement.style.setProperty('--ground-art', `url('${ART_BASE}night-ground.webp')`)

class AudioPulse {
  private context?: AudioContext
  private muted = false
  private lastShot = 0

  unlock() {
    if (!this.context) this.context = new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
  }

  toggle(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  event(type: string) {
    if (!this.context || this.muted) return
    const now = this.context.currentTime
    if (type === 'shot' && now - this.lastShot < 0.045) return
    if (type === 'shot') this.lastShot = now
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    const settings: Record<string, [number, number, number]> = {
      shot: [125, 70, 0.025], hurt: [95, 45, 0.12], level: [410, 720, 0.18],
      boss: [65, 38, 0.34], buff: [260, 760, 0.34], revive: [300, 560, 0.2], awaken: [220, 880, 0.34], win: [360, 920, 0.5], lose: [150, 60, 0.55],
    }
    const [start, end, duration] = settings[type] ?? [170, 130, 0.04]
    oscillator.type = type === 'boss' || type === 'lose' ? 'sawtooth' : 'triangle'
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration)
    gain.gain.setValueAtTime(type === 'shot' ? 0.018 : 0.045, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    oscillator.connect(gain).connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration)
  }
}

class DawnfallApp {
  private screen: Screen = 'home'
  private mode: SessionMode = 'solo'
  private duration = 240
  private party: PlayerConfig[] = []
  private localConfig: PlayerConfig
  private engine?: GameEngine
  private snapshot?: GameSnapshot
  private renderer?: GameRenderer
  private animationFrame = 0
  private lastFrame = performance.now()
  private lastHud = 0
  private lastBroadcast = 0
  private lastInputSend = 0
  private lastSnapshotAt = performance.now()
  private lastSentInput?: InputState
  private lastHandledEvent = 0
  private finishQueued = false
  private spectatingId?: string
  private readonly inputs = new Map<string, InputState>()
  private readonly localInput: InputState = { up: false, down: false, left: false, right: false, firing: false, interact: false, aim: 0 }
  private readonly audio = new AudioPulse()
  private readonly network: MultiplayerSession

  constructor() {
    const storedName = localStorage.getItem('dawnfall-player-name')?.slice(0, 18) || 'Hunter'
    this.localConfig = {
      id: makePlayerId(),
      name: storedName,
      character: 'vesper',
      weapon: 'revolver',
      color: PLAYER_COLORS[0],
    }
    this.network = new MultiplayerSession({
      onLobby: (players) => {
        this.party = players
        if (this.screen === 'lobby') this.renderLobby()
      },
      onStart: (configs, duration, seed) => this.beginGuestGame(configs, duration, seed),
      onSnapshot: (snapshot) => {
        this.snapshot = snapshot
        this.lastSnapshotAt = performance.now()
      },
      onGuestInput: (playerId, input) => this.inputs.set(playerId, input),
      onUpgrade: (playerId, upgradeId) => this.engine?.chooseUpgrade(upgradeId, playerId),
      onReroll: (playerId) => this.engine?.rerollUpgrade(playerId),
      onNotice: (text) => this.showNotice(text),
      onError: (message) => this.showNotice(message, true),
    })

    window.addEventListener('beforeunload', () => this.network.close())
    this.renderHome()
  }

  private renderHome() {
    this.stopGameLoop()
    this.screen = 'home'
    const roomFromUrl = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? ''
    app.innerHTML = `
      <main class="landing-shell">
        <header class="topbar">
          <a class="wordmark" href="./" aria-label="Dawnfall Protocol home"><span class="sigil">◈</span> DAWNFALL <i>PROTOCOL</i></a>
          <button class="text-button" id="about-button">DESIGN NOTES</button>
        </header>
        <section class="hero-grid">
          <div class="hero-art-flare" aria-hidden="true"></div>
          <div class="hero-copy">
            <p class="eyebrow">1–4 PLAYER CO-OP SURVIVAL ROGUELITE</p>
            <h1>HOLD THE LINE<br><em>UNTIL DAWN.</em></h1>
            <p class="hero-lede">Aim every shot. Shape your hunter. Survive one impossible night together.</p>
            <div class="run-readout" aria-label="Twenty minute run timeline">
              <span>20:00</span><div><i></i><i></i><i></i></div><strong>00:00</strong>
            </div>
          </div>
          <div class="entry-panel" data-testid="entry-panel">
            <label class="field-label" for="player-name">CALLSIGN</label>
            <input id="player-name" class="field-input" maxlength="18" value="${escapeHtml(this.localConfig.name)}" autocomplete="nickname">
            <div class="entry-actions">
              <button class="primary-button" id="solo-button" data-testid="solo-button"><span>PLAY SOLO</span><small>Learn the night</small></button>
              <button class="secondary-button" id="host-button"><span>HOST A SQUAD</span><small>Invite up to 3 friends</small></button>
            </div>
            <div class="join-divider"><span>OR JOIN A HUNT</span></div>
            <div class="join-row">
              <input id="room-code" class="field-input code-input" maxlength="6" placeholder="ROOM CODE" value="${escapeHtml(roomFromUrl)}" aria-label="Six character room code">
              <button class="square-button" id="join-button" aria-label="Join room">→</button>
            </div>
            <p class="network-note">No account. No install. Multiplayer uses a direct browser connection.</p>
            <p class="form-status" id="form-status" role="status"></p>
          </div>
        </section>
        <section class="principles" aria-label="Core game mechanics">
          <article><b>01</b><span>ACTIVE COMBAT</span><p>WASD to move. Mouse to aim and fire. Ammunition and reload timing matter.</p></article>
          <article><b>02</b><span>RARE POWER SPIKES</span><p>Squad levels arrive less often, but every perk can transform a hunter's build.</p></article>
          <article><b>03</b><span>BOSS RELICS</span><p>Slay four night lords to earn the only powers shared by the entire squad.</p></article>
        </section>
        <footer class="landing-footer"><span>ORIGINAL BROWSER PROTOTYPE · DESKTOP RECOMMENDED</span><span>NOT AFFILIATED WITH 20 MINUTES TILL DAWN</span></footer>
      </main>
      <dialog id="design-dialog" class="design-dialog">
        <button class="dialog-close" aria-label="Close design notes">×</button>
        <p class="eyebrow">DESIGN DNA</p>
        <h2>What came from the research</h2>
        <p><em>20 Minutes Till Dawn</em> stands apart from passive survivor-likes through directional aiming, active firing, magazines, reloads, character–weapon pairing, upgrade trees, and boss-granted power spikes.</p>
        <p>Dawnfall keeps that active tension while giving the squad one shared XP track. Rarer levels pause the night for simultaneous personal drafts: three one-of-one choices and three rerolls for every active hunter. Character companions and signature powers create distinct personal builds; boss relics remain the rare squad-wide power spike.</p>
        <div class="dialog-rule"></div>
        <p class="small-copy">This prototype uses original names, code, balancing, visual language, characters, enemies, abilities, and hand-directed generated artwork.</p>
      </dialog>
    `
    this.bindHomeEvents()
  }

  private bindHomeEvents() {
    const nameInput = document.querySelector<HTMLInputElement>('#player-name')
    const saveName = () => {
      const value = nameInput?.value.trim().slice(0, 18) || 'Hunter'
      this.localConfig.name = value
      localStorage.setItem('dawnfall-player-name', value)
    }
    nameInput?.addEventListener('change', saveName)
    document.querySelector('#solo-button')?.addEventListener('click', () => {
      saveName(); this.audio.unlock(); this.mode = 'solo'; this.party = [this.localConfig]; this.renderLobby()
    })
    document.querySelector('#host-button')?.addEventListener('click', async () => {
      saveName(); this.audio.unlock(); this.setFormStatus('Opening a squad room…')
      try {
        await this.network.host(this.localConfig)
        this.mode = 'host'
        this.party = [this.localConfig]
        this.renderLobby()
      } catch (error) {
        this.setFormStatus(error instanceof Error ? error.message : 'Could not open a squad room.', true)
      }
    })
    document.querySelector('#join-button')?.addEventListener('click', async () => {
      saveName(); this.audio.unlock()
      const code = document.querySelector<HTMLInputElement>('#room-code')?.value.trim().toUpperCase() ?? ''
      if (code.length !== 6) { this.setFormStatus('Enter the six-character room code.', true); return }
      this.setFormStatus('Finding that squad…')
      try {
        await this.network.join(code, this.localConfig)
        this.mode = 'guest'
        this.renderLobby()
      } catch (error) {
        this.setFormStatus(error instanceof Error ? error.message : 'Could not join that squad.', true)
      }
    })
    const dialog = document.querySelector<HTMLDialogElement>('#design-dialog')
    document.querySelector('#about-button')?.addEventListener('click', () => dialog?.showModal())
    document.querySelector('.dialog-close')?.addEventListener('click', () => dialog?.close())
    if (new URLSearchParams(window.location.search).has('room')) document.querySelector<HTMLInputElement>('#room-code')?.focus()
  }

  private renderLobby() {
    this.screen = 'lobby'
    const canStart = this.mode !== 'guest'
    const roomCode = this.network.roomCode
    const shareUrl = roomCode ? this.createShareUrl(roomCode) : ''
    app.innerHTML = `
      <main class="lobby-shell">
        <header class="topbar">
          <button class="wordmark button-reset" id="leave-button"><span class="sigil">◈</span> DAWNFALL <i>PROTOCOL</i></button>
          <div class="lobby-heading"><span>${this.mode === 'solo' ? 'SOLO LOADOUT' : 'SQUAD ASSEMBLY'}</span><b>${this.party.length}/4 HUNTERS</b></div>
        </header>
        <div class="lobby-layout">
          <section class="loadout-column">
            <div class="section-heading"><span>01</span><div><h2>CHOOSE YOUR HUNTER</h2><p>Base abilities define your role before the first perk drops.</p></div><button class="random-loadout-button" data-random-character data-testid="random-character">✦ RANDOM HUNTER</button></div>
            <div class="character-grid">
              ${CHARACTERS.map((character) => `
                <button class="selection-card character-card ${this.localConfig.character === character.id ? 'selected' : ''}" data-character="${character.id}" style="--accent:${character.color}">
                  <span class="portrait-art" style="${portraitStyle(character.id)}"></span>
                  <span class="portrait-sigil">${character.glyph}</span>
                  <span class="card-copy"><small>${character.epithet}</small><strong>${character.name}</strong><em>${character.description}</em><b>${character.baseAbility}</b></span>
                </button>`).join('')}
            </div>
            <div class="section-heading compact"><span>02</span><div><h2>CHOOSE YOUR WEAPON</h2><p>Every hunter can carry every weapon.</p></div><button class="random-loadout-button" data-random-weapon data-testid="random-weapon">⌁ RANDOM WEAPON</button></div>
            <div class="weapon-grid">
              ${WEAPONS.map((weapon) => `
                <button class="selection-card weapon-card ${this.localConfig.weapon === weapon.id ? 'selected' : ''}" data-weapon="${weapon.id}">
                  <span class="weapon-art" style="${weaponArtStyle(weapon.id)}"></span><span><strong>${weapon.name}</strong><em>${weapon.description}</em></span>
                  <span class="weapon-stats"><b>${weapon.damage}</b><small>DMG</small><b>${weapon.infiniteAmmo ? '∞' : weapon.magazine}</b><small>${weapon.infiniteAmmo ? 'AMMO' : 'MAG'}</small></span>
                </button>`).join('')}
            </div>
          </section>
          <aside class="party-column">
            ${roomCode ? `<div class="room-card"><small>ROOM CODE</small><strong>${roomCode}</strong><button id="copy-link-button" data-url="${escapeHtml(shareUrl)}">COPY INVITE LINK</button></div>` : ''}
            <div class="party-list">
              <div class="aside-label">HUNTING PARTY</div>
              ${this.party.map((player, index) => {
                const character = characterById(player.character)
                const weapon = weaponById(player.weapon)
                return `<article class="party-member"><span class="party-number">0${index + 1}</span><span class="party-avatar" style="--player:${player.color};${portraitStyle(player.character)}"></span><div><strong>${escapeHtml(player.name)}${player.id === this.localConfig.id ? ' · YOU' : ''}</strong><small>${character.name} / ${weapon.name}</small></div><i>READY</i></article>`
              }).join('')}
              ${Array.from({ length: Math.max(0, 4 - this.party.length) }, (_, index) => `<article class="party-member empty"><span class="party-number">0${this.party.length + index + 1}</span><span class="party-avatar">·</span><div><strong>OPEN SLOT</strong><small>Waiting in the dark</small></div></article>`).join('')}
            </div>
            ${canStart ? `
              <div class="duration-picker">
                <div class="aside-label">NIGHT LENGTH</div>
                <button class="duration-option ${this.duration === 240 ? 'selected' : ''}" data-duration="240"><span>FIELD TEST</span><b>04:00</b><small>All milestones compressed</small></button>
                <button class="duration-option ${this.duration === 1200 ? 'selected' : ''}" data-duration="1200"><span>FULL NIGHT</span><b>20:00</b><small>The intended survival run</small></button>
              </div>
              <button class="launch-button" id="launch-button" data-testid="launch-button"><span>BEGIN THE HUNT</span><b>→</b></button>
            ` : `<div class="waiting-card"><span class="waiting-pulse"></span><strong>WAITING FOR HOST</strong><small>The host chooses when the night begins.</small></div>`}
            <p class="lobby-footnote">Best on desktop Chrome, Edge, Firefox, or Safari. Some strict networks may block direct WebRTC connections.</p>
          </aside>
        </div>
      </main>
      <div class="notice" id="notice" role="status"></div>
    `
    this.bindLobbyEvents()
  }

  private bindLobbyEvents() {
    document.querySelector('#leave-button')?.addEventListener('click', () => { this.network.close(); window.history.replaceState({}, '', window.location.pathname); this.renderHome() })
    document.querySelectorAll<HTMLElement>('[data-character]').forEach((button) => button.addEventListener('click', () => {
      this.localConfig.character = button.dataset.character as PlayerConfig['character']
      this.updateLocalLoadout()
    }))
    document.querySelectorAll<HTMLElement>('[data-weapon]').forEach((button) => button.addEventListener('click', () => {
      this.localConfig.weapon = button.dataset.weapon as PlayerConfig['weapon']
      this.updateLocalLoadout()
    }))
    document.querySelector<HTMLElement>('[data-random-character]')?.addEventListener('click', () => {
      const choices = CHARACTERS.filter((character) => character.id !== this.localConfig.character)
      this.localConfig.character = choices[Math.floor(Math.random() * choices.length)].id
      this.updateLocalLoadout()
    })
    document.querySelector<HTMLElement>('[data-random-weapon]')?.addEventListener('click', () => {
      const choices = WEAPONS.filter((weapon) => weapon.id !== this.localConfig.weapon)
      this.localConfig.weapon = choices[Math.floor(Math.random() * choices.length)].id
      this.updateLocalLoadout()
    })
    document.querySelectorAll<HTMLElement>('[data-duration]').forEach((button) => button.addEventListener('click', () => {
      this.duration = Number(button.dataset.duration)
      this.renderLobby()
    }))
    document.querySelector('#copy-link-button')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement
      try { await navigator.clipboard.writeText(button.dataset.url ?? ''); button.textContent = 'INVITE COPIED' }
      catch { button.textContent = 'COPY FAILED — SHARE CODE' }
    })
    document.querySelector('#launch-button')?.addEventListener('click', () => {
      this.audio.unlock()
      const seed = Date.now() % 2_147_483_647
      if (this.mode === 'host') this.network.startGame(this.duration, seed)
      this.beginHostGame(this.party, this.duration, seed)
    })
  }

  private updateLocalLoadout() {
    this.party = this.party.map((player) => player.id === this.localConfig.id ? { ...this.localConfig } : player)
    if (this.mode !== 'solo') this.network.updateConfig({ ...this.localConfig })
    else this.renderLobby()
  }

  private beginHostGame(configs: PlayerConfig[], duration: number, seed: number) {
    this.engine = new GameEngine(configs, duration, seed)
    this.snapshot = this.engine.snapshot
    this.inputs.clear()
    this.inputs.set(this.localConfig.id, this.localInput)
    this.renderGame()
  }

  private beginGuestGame(configs: PlayerConfig[], duration: number, seed: number) {
    this.engine = undefined
    this.snapshot = new GameEngine(configs, duration, seed).snapshot
    this.lastSnapshotAt = performance.now()
    this.renderGame()
  }

  private renderGame() {
    this.stopGameLoop()
    this.screen = 'game'
    this.finishQueued = false
    this.spectatingId = undefined
    this.lastHandledEvent = 0
    app.innerHTML = `
      <main class="game-shell" data-testid="game-shell">
        <canvas id="game-canvas" aria-label="Dawnfall Protocol game arena"></canvas>
        <section class="game-hud" aria-live="off">
          <div class="hud-top-left"><span class="hud-brand">◈ DAWNFALL</span><div id="level-readout">LV. 01</div></div>
          <div class="timer-block"><small id="timer-label">UNTIL DAWN</small><strong id="timer-readout">${formatTime(this.snapshot?.timeRemaining ?? this.duration)}</strong><div class="xp-track"><i id="xp-fill"></i></div></div>
          <button class="mute-button" id="mute-button" aria-label="Toggle sound">SOUND ON</button>
          <div class="team-hud" id="team-hud"></div>
          <div class="team-buffs-hud" id="team-buffs-hud"></div>
          <div class="perks-hud" id="perks-hud"></div>
          <div class="ammo-hud" id="ammo-hud"></div>
          <div class="boss-hud" id="boss-hud"></div>
          <div class="controls-hud"><span><kbd>WASD</kbd> MOVE</span><span><kbd>MOUSE</kbd> AIM + FIRE</span><span><kbd>E</kbd> REVIVE</span></div>
          <div class="event-banner" id="event-banner"></div>
          <div class="spectator-hud" id="spectator-hud">
            <button id="spectate-prev" aria-label="Watch previous ally">‹</button>
            <div><small>YOU FELL · WATCHING</small><strong id="spectator-name">ALLY</strong><span>Q / E TO CYCLE</span></div>
            <button id="spectate-next" aria-label="Watch next ally">›</button>
          </div>
          <div class="upgrade-overlay" id="upgrade-overlay"></div>
        </section>
      </main>
    `
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')
    if (!canvas) throw new Error('Game canvas was not created.')
    this.renderer = new GameRenderer(canvas, ART_BASE)
    this.bindGameEvents(canvas)
    this.lastFrame = performance.now()
    this.lastHud = 0
    this.lastBroadcast = 0
    this.lastInputSend = 0
    this.lastSentInput = undefined
    this.animationFrame = requestAnimationFrame((time) => this.gameLoop(time))
  }

  private bindGameEvents(canvas: HTMLCanvasElement) {
    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'BUTTON') return
      const localEliminated = this.snapshot?.players.find((player) => player.id === this.localConfig.id)?.eliminated
      if (pressed && localEliminated && ['KeyQ', 'BracketLeft'].includes(event.code)) { event.preventDefault(); this.cycleSpectator(-1); return }
      if (pressed && localEliminated && ['KeyE', 'BracketRight'].includes(event.code)) { event.preventDefault(); this.cycleSpectator(1); return }
      if (['KeyW', 'ArrowUp'].includes(event.code)) this.localInput.up = pressed
      if (['KeyS', 'ArrowDown'].includes(event.code)) this.localInput.down = pressed
      if (['KeyA', 'ArrowLeft'].includes(event.code)) this.localInput.left = pressed
      if (['KeyD', 'ArrowRight'].includes(event.code)) this.localInput.right = pressed
      if (event.code === 'KeyE' && !localEliminated) this.localInput.interact = pressed
    }
    window.onkeydown = (event) => setKey(event, true)
    window.onkeyup = (event) => setKey(event, false)
    canvas.addEventListener('pointermove', (event) => { this.localInput.aim = this.renderer?.aimFromPointer(event.clientX, event.clientY) ?? 0 })
    canvas.addEventListener('pointerdown', (event) => { if (event.button === 0) { this.audio.unlock(); this.localInput.firing = true } })
    window.onpointerup = () => { this.localInput.firing = false }
    canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    window.onresize = () => this.renderer?.resize()
    document.querySelector('#mute-button')?.addEventListener('click', (event) => {
      const muted = this.audio.toggle()
      ;(event.currentTarget as HTMLButtonElement).textContent = muted ? 'SOUND OFF' : 'SOUND ON'
    })
    document.querySelector('#spectate-prev')?.addEventListener('click', () => this.cycleSpectator(-1))
    document.querySelector('#spectate-next')?.addEventListener('click', () => this.cycleSpectator(1))
  }

  private gameLoop(time: number) {
    if (this.screen !== 'game') return
    const dt = Math.min(0.05, (time - this.lastFrame) / 1000)
    this.lastFrame = time
    const viewport = this.renderer?.viewportSize()
    if (viewport) {
      this.localInput.viewportWidth = Math.round(viewport.width)
      this.localInput.viewportHeight = Math.round(viewport.height)
    }
    this.inputs.set(this.localConfig.id, { ...this.localInput })

    if (this.mode !== 'guest' && this.engine) {
      this.snapshot = this.engine.step(dt, this.inputs)
      if (this.mode === 'host' && time - this.lastBroadcast > 100) {
        this.network.broadcastSnapshot(this.snapshot)
        this.lastBroadcast = time
      }
    } else if (this.mode === 'guest') {
      const inputChanged = this.inputChanged(this.localInput, this.lastSentInput)
      const sendInterval = inputChanged ? 24 : 160
      if (time - this.lastInputSend > sendInterval) {
        const input = { ...this.localInput }
        this.network.sendInput(this.localConfig.id, input)
        this.lastSentInput = input
        this.lastInputSend = time
      }
    }

    if (this.snapshot) {
      const focusPlayerId = this.resolveFocusPlayerId(this.snapshot)
      const prediction = this.mode === 'guest' ? Math.min(0.12, Math.max(0, (time - this.lastSnapshotAt) / 1000)) : 0
      this.renderer?.render(this.snapshot, this.localConfig.id, focusPlayerId, prediction)
      if (time - this.lastHud > 80) {
        this.updateHud(this.snapshot)
        this.lastHud = time
      }
      this.handleGameEvents(this.snapshot)
      if (!this.finishQueued && (this.snapshot.phase === 'victory' || this.snapshot.phase === 'defeat')) {
        this.finishQueued = true
        window.setTimeout(() => this.renderRecap(), 1800)
      }
    }
    this.animationFrame = requestAnimationFrame((nextTime) => this.gameLoop(nextTime))
  }

  private inputChanged(next: InputState, previous?: InputState): boolean {
    if (!previous) return true
    if (next.up !== previous.up || next.down !== previous.down || next.left !== previous.left || next.right !== previous.right
      || next.firing !== previous.firing || next.interact !== previous.interact) return true
    if (next.viewportWidth !== previous.viewportWidth || next.viewportHeight !== previous.viewportHeight) return true
    const aimDifference = Math.abs(Math.atan2(Math.sin(next.aim - previous.aim), Math.cos(next.aim - previous.aim)))
    return aimDifference > 0.015
  }

  private resolveFocusPlayerId(snapshot: GameSnapshot): string {
    const local = snapshot.players.find((player) => player.id === this.localConfig.id)
    if (!local?.eliminated) { this.spectatingId = undefined; return local?.id ?? snapshot.players[0]?.id ?? this.localConfig.id }
    const watchable = snapshot.players.filter((player) => !player.eliminated && !player.downed)
    const fallback = watchable.length > 0 ? watchable : snapshot.players.filter((player) => !player.eliminated)
    if (!fallback.some((player) => player.id === this.spectatingId)) this.spectatingId = fallback[0]?.id
    return this.spectatingId ?? local.id
  }

  private cycleSpectator(direction: number) {
    if (!this.snapshot) return
    const local = this.snapshot.players.find((player) => player.id === this.localConfig.id)
    if (!local?.eliminated) return
    const standing = this.snapshot.players.filter((player) => !player.eliminated && !player.downed)
    const watchable = standing.length > 0 ? standing : this.snapshot.players.filter((player) => !player.eliminated)
    if (watchable.length === 0) return
    const current = watchable.findIndex((player) => player.id === this.spectatingId)
    this.spectatingId = watchable[(current + direction + watchable.length) % watchable.length].id
    this.updateHud(this.snapshot)
  }

  private updateHud(snapshot: GameSnapshot) {
    const localPlayer = snapshot.players.find((player) => player.id === this.localConfig.id) ?? snapshot.players[0]
    const focusId = this.resolveFocusPlayerId(snapshot)
    const hudPlayer = localPlayer?.eliminated ? snapshot.players.find((player) => player.id === focusId) ?? localPlayer : localPlayer
    const timer = document.querySelector('#timer-readout')
    const timerLabel = document.querySelector('#timer-label')
    const level = document.querySelector('#level-readout')
    const xpFill = document.querySelector<HTMLElement>('#xp-fill')
    if (timer) {
      timer.textContent = formatTime(snapshot.timeRemaining)
      timer.classList.toggle('overtime', snapshot.timeRemaining < 0)
    }
    if (timerLabel) timerLabel.textContent = snapshot.timeRemaining < 0 ? 'OVERTIME · SLAY THE TRIO' : 'UNTIL DAWN'
    if (level) level.textContent = `${localPlayer?.eliminated ? 'WATCHING · ' : ''}LV. ${(hudPlayer?.level ?? 1).toString().padStart(2, '0')}`
    if (xpFill) xpFill.style.width = `${Math.min(100, ((hudPlayer?.xp ?? 0) / Math.max(1, hudPlayer?.xpToNext ?? 1)) * 100)}%`

    const team = document.querySelector('#team-hud')
    if (team) team.innerHTML = snapshot.players.map((player) => `
      <article class="team-chip ${player.downed ? 'downed' : ''} ${player.eliminated ? 'eliminated' : ''} ${player.id === focusId && localPlayer?.eliminated ? 'watching' : ''}">
        <span class="team-portrait" style="--player:${player.color};${portraitStyle(player.character)}"></span>
        <div><b>${escapeHtml(player.name)} · L${player.level}</b><i><em style="width:${(player.health / player.maxHealth) * 100}%"></em></i></div>
        <small>${player.eliminated ? 'LOST' : player.downed ? `${Math.ceil(player.downTimer)}s` : player.id === focusId && localPlayer?.eliminated ? 'VIEW' : `${Math.ceil(player.health)}`}</small>
      </article>`).join('')

    const perks = document.querySelector('#perks-hud')
    const activePerks = Object.entries(hudPlayer?.perks ?? {}).filter(([, perkRank]) => perkRank > 0).slice(-10)
    if (perks) perks.innerHTML = activePerks.map(([id, perkRank]) => perkIconMarkup(id, 'perk-medallion', 'span', perkRank)).join('')

    const ammo = document.querySelector('#ammo-hud')
    if (ammo && hudPlayer) {
      const weapon = weaponById(hudPlayer.weapon)
      const reloading = hudPlayer.reloadRemaining > 0
      const reloadProgress = reloading ? 1 - hudPlayer.reloadRemaining / hudPlayer.reloadDuration : 1
      ammo.innerHTML = `<small>${localPlayer?.eliminated ? `${escapeHtml(hudPlayer.name.toUpperCase())} · ` : ''}${weapon.name.toUpperCase()}</small><strong>${weapon.infiniteAmmo ? '∞' : reloading ? 'RELOAD' : `${hudPlayer.ammo} / ${hudPlayer.maxAmmo}`}</strong><i><em style="width:${reloadProgress * 100}%"></em></i>`
    }

    const finaleBosses = snapshot.enemies.filter((enemy) => enemy.finale && enemy.health > 0)
    const boss = snapshot.enemies.find((enemy) => isBoss(enemy.type))
    const bossHud = document.querySelector<HTMLElement>('#boss-hud')
    if (bossHud) {
      bossHud.classList.toggle('visible', finaleBosses.length > 0 || Boolean(boss))
      if (finaleBosses.length > 0) {
        bossHud.innerHTML = `<span>DAWNLESS TRIUMVIRATE · ${finaleBosses.length}/3 REMAIN</span><div class="trio-health">${FINAL_TRIO_TYPES.map((type) => {
          const member = finaleBosses.find((enemy) => enemy.type === type)
          return `<i title="${BOSS_NAMES[type]}"><em style="width:${member ? (member.health / member.maxHealth) * 100 : 0}%"></em></i>`
        }).join('')}</div>`
      } else {
        bossHud.innerHTML = boss && isBoss(boss.type) ? `<span>${BOSS_NAMES[boss.type]}</span><i><em style="width:${(boss.health / boss.maxHealth) * 100}%"></em></i>` : ''
      }
    }
    const teamBuffs = document.querySelector<HTMLElement>('#team-buffs-hud')
    if (teamBuffs) teamBuffs.innerHTML = Object.entries(snapshot.teamBuffs).filter(([, buffRank]) => buffRank > 0).map(([id, buffRank]) => {
      const buff = teamBuffById(id)
      return `<span title="${buff.name}: ${buff.description}" style="--accent:${buff.accent}">${buff.icon}<b>${buffRank}</b></span>`
    }).join('')
    const spectator = document.querySelector<HTMLElement>('#spectator-hud')
    if (spectator) spectator.classList.toggle('visible', Boolean(localPlayer?.eliminated && snapshot.phase !== 'defeat'))
    const spectatorName = document.querySelector<HTMLElement>('#spectator-name')
    if (spectatorName && localPlayer?.eliminated && hudPlayer) spectatorName.textContent = `${hudPlayer.name.toUpperCase()} · ${characterById(hudPlayer.character).name.toUpperCase()}`
    this.renderUpgrade(snapshot)
  }

  private renderUpgrade(snapshot: GameSnapshot) {
    const overlay = document.querySelector<HTMLElement>('#upgrade-overlay')
    if (!overlay) return
    const offer = snapshot.upgrade
    if (!offer || snapshot.phase !== 'upgrade') {
      overlay.innerHTML = ''
      overlay.classList.remove('visible')
      delete overlay.dataset.offer
      return
    }
    const localPlayer = snapshot.players.find((player) => player.id === this.localConfig.id)
    const localOffer = offer.offers.find((entry) => entry.chooserId === this.localConfig.id)
    const localChooses = Boolean(localOffer && !localOffer.selectedId)
    const draftLocked = offer.acceptsInputIn > 0
    const offerKey = `${offer.level}-${draftLocked ? 'locked' : 'ready'}-${offer.offers.map((entry) => `${entry.chooserId}:${entry.ids.join('.')}:${entry.rerollsLeft}:${entry.selectedId ?? ''}`).join('|')}`
    if (overlay.dataset.offer === offerKey) {
      const countdown = overlay.querySelector('[data-countdown]')
      if (countdown) countdown.textContent = Math.ceil(offer.expiresIn).toString()
      const inputDelay = overlay.querySelector('[data-input-delay]')
      if (inputDelay) inputDelay.textContent = Math.max(0, offer.acceptsInputIn).toFixed(1)
      return
    }
    overlay.dataset.offer = offerKey
    overlay.classList.add('visible')
    overlay.innerHTML = `
      <div class="upgrade-backdrop"></div>
      <section class="upgrade-draft">
        <p class="eyebrow">SQUAD LEVEL ${offer.level + 1} · PARALLEL DRAFT</p>
        <h2>${localChooses ? 'SHAPE YOUR HUNTER' : localOffer?.selectedId ? 'YOUR UPGRADE IS LOCKED' : 'THE SQUAD IS CHOOSING'}</h2>
        <p>Every active hunter gets three transformative choices and three personal rerolls. Combat resumes when everyone locks in. Auto-lock in <b data-countdown>${Math.ceil(offer.expiresIn)}</b>s.</p>
        <p class="draft-input-lock ${draftLocked ? 'locked' : 'ready'}">${draftLocked ? `LOOK OVER YOUR OPTIONS · CHOICES UNLOCK IN <b data-input-delay>${offer.acceptsInputIn.toFixed(1)}</b>s` : 'CHOICES UNLOCKED · SELECT WHEN READY'}</p>
        <div class="upgrade-status">
          ${offer.offers.map((entry) => {
            const player = snapshot.players.find((candidate) => candidate.id === entry.chooserId)
            return `<div class="${entry.selectedId ? 'ready' : ''}"><span style="--player:${player?.color ?? '#f2d479'};${portraitStyle(player?.character ?? 'vesper')}"></span><b>${escapeHtml(player?.name ?? 'Hunter')}</b><small>${entry.selectedId ? 'LOCKED' : 'CHOOSING'}</small></div>`
          }).join('')}
        </div>
        ${localChooses && localOffer ? `<div class="upgrade-cards">
          ${localOffer.ids.map((id) => {
            const upgrade = upgradeById(id)
            const nextRank = (localPlayer?.perks[id] ?? 0) + 1
            const origin = upgrade.category === 'signature'
              ? `${characterById(upgrade.character!).name.toUpperCase()} SIGNATURE`
              : upgrade.category === 'weapon'
                ? `${weaponById(upgrade.weapon!).name.toUpperCase()} ARMAMENT`
                : 'COMMON POWER'
            return `<button class="upgrade-card ${upgrade.category}" data-upgrade="${id}" style="--accent:${upgrade.accent}" ${draftLocked ? 'disabled aria-disabled="true"' : ''}>${perkIconMarkup(id, 'upgrade-art')}<small>${origin} · ${upgrade.maxLevel === 1 ? 'ONE-OF-ONE' : `RANK ${nextRank}/${upgrade.maxLevel}`}</small><strong>${upgrade.name}</strong><em>${upgrade.description}</em><b>${draftLocked ? 'READ BEFORE CHOOSING' : 'LOCK CHOICE →'}</b></button>`
          }).join('')}
        </div><div class="upgrade-actions"><button class="reroll-button" data-reroll ${localOffer.rerollsLeft > 0 && !draftLocked ? '' : 'disabled'}>↻ REROLL ALL THREE · ${localOffer.rerollsLeft} LEFT</button></div>` : `<div class="upgrade-waiting"><span class="waiting-pulse"></span><strong>${localOffer?.selectedId ? escapeHtml(upgradeById(localOffer.selectedId).name.toUpperCase()) : 'WAITING FOR ACTIVE HUNTERS'}</strong><small>${localOffer?.selectedId ? 'Your build is ready. The night resumes after the remaining choices.' : 'Spectating this squad draft.'}</small></div>`}
      </section>`
    overlay.querySelectorAll<HTMLElement>('[data-upgrade]').forEach((button) => button.addEventListener('click', () => {
      const upgradeId = button.dataset.upgrade
      if (!upgradeId) return
      if (this.mode === 'guest') this.network.sendUpgrade(this.localConfig.id, upgradeId)
      else this.engine?.chooseUpgrade(upgradeId, this.localConfig.id)
    }))
    overlay.querySelector<HTMLElement>('[data-reroll]')?.addEventListener('click', () => {
      if (this.mode === 'guest') this.network.sendReroll(this.localConfig.id)
      else this.engine?.rerollUpgrade(this.localConfig.id)
    })
  }

  private handleGameEvents(snapshot: GameSnapshot) {
    for (const event of snapshot.events) {
      if (event.id <= this.lastHandledEvent) continue
      this.lastHandledEvent = event.id
      this.audio.event(event.type)
      if (event.text) {
        const banner = document.querySelector<HTMLElement>('#event-banner')
        if (banner) {
          banner.textContent = event.text
          banner.classList.remove('show')
          void banner.offsetWidth
          banner.classList.add('show')
        }
      }
    }
  }

  private renderRecap() {
    if (!this.snapshot) return
    this.stopGameLoop()
    this.screen = 'recap'
    const won = this.snapshot.phase === 'victory'
    const totalKills = this.snapshot.players.reduce((sum, player) => sum + player.kills, 0)
    const totalDamage = this.snapshot.players.reduce((sum, player) => sum + player.damageDealt, 0)
    const highestLevel = Math.max(...this.snapshot.players.map((player) => player.level), 1)
    app.innerHTML = `
      <main class="recap-shell ${won ? 'victory' : 'defeat'}">
        <div class="recap-sigil">${won ? '☼' : '◈'}</div>
        <p class="eyebrow">HUNT COMPLETE</p>
        <h1>${won ? 'DAWN FOUND YOU.' : 'THE NIGHT WON.'}</h1>
        <p>${won ? 'The squad held long enough for the first light to break.' : 'Every hunter fell before the horizon changed.'}</p>
        <section class="recap-stats">
          <article><small>TIME HELD</small><strong>${formatTime(this.snapshot.duration - this.snapshot.timeRemaining)}</strong></article>
          <article><small>HIGHEST LEVEL</small><strong>${highestLevel}</strong></article>
          <article><small>ENEMIES FELLED</small><strong>${totalKills}</strong></article>
          <article><small>DAMAGE DEALT</small><strong>${Math.round(totalDamage).toLocaleString()}</strong></article>
        </section>
        <section class="recap-party">
          ${this.snapshot.players.map((player) => `<article><span class="recap-portrait" style="--player:${player.color};${portraitStyle(player.character)}"></span><div><strong>${escapeHtml(player.name)} · LEVEL ${player.level}</strong><small>${characterById(player.character).name} · ${weaponById(player.weapon).name}</small></div><b>${player.kills} KILLS</b><em>${Math.round(player.damageDealt).toLocaleString()} DMG</em></article>`).join('')}
        </section>
        <div class="recap-build"><small>FINAL HUNTER BUILDS</small>${this.snapshot.players.map((player) => {
          const activePerks = Object.entries(player.perks).filter(([, perkRank]) => perkRank > 0)
          return `<section><strong>${escapeHtml(player.name)} · ${characterById(player.character).name}</strong><div>${activePerks.length ? activePerks.map(([id, perkRank]) => `<span>${perkIconMarkup(id, 'recap-perk-icon', 'i')}${upgradeById(id).name} <b>×${perkRank}</b></span>`).join('') : '<em>No perks secured.</em>'}</div></section>`
        }).join('')}<section><strong>SQUAD RELICS</strong><div>${Object.entries(this.snapshot.teamBuffs).filter(([, buffRank]) => buffRank > 0).map(([id, buffRank]) => { const buff = teamBuffById(id); return `<span><i class="recap-perk-icon glyph-icon" style="--accent:${buff.accent}">${buff.icon}</i>${buff.name} <b>×${buffRank}</b></span>` }).join('') || '<em>No boss relics claimed.</em>'}</div></section></div>
        <div class="recap-actions"><button class="primary-button" id="again-button">RUN IT AGAIN</button><button class="secondary-button" id="home-button">RETURN TO CAMP</button></div>
        <p class="prototype-note">BALANCE NOTE · This is a combat-and-networking prototype. Numbers, spawn density, and WebRTC reliability need broader playtest data.</p>
      </main>`
    document.querySelector('#again-button')?.addEventListener('click', () => {
      if (this.mode === 'guest') { this.network.close(); this.renderHome() }
      else this.renderLobby()
    })
    document.querySelector('#home-button')?.addEventListener('click', () => { this.network.close(); this.renderHome() })
  }

  private stopGameLoop() {
    cancelAnimationFrame(this.animationFrame)
    this.animationFrame = 0
    window.onkeydown = null
    window.onkeyup = null
    window.onpointerup = null
    window.onresize = null
  }

  private createShareUrl(roomCode: string): string {
    const url = new URL(window.location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('room', roomCode)
    return url.toString()
  }

  private setFormStatus(message: string, error = false) {
    const status = document.querySelector<HTMLElement>('#form-status')
    if (status) { status.textContent = message; status.classList.toggle('error', error) }
  }

  private showNotice(message: string, error = false) {
    const notice = document.querySelector<HTMLElement>('#notice') ?? document.querySelector<HTMLElement>('#form-status')
    if (!notice) return
    notice.textContent = message
    notice.classList.toggle('error', error)
    notice.classList.add('show')
    window.setTimeout(() => notice.classList.remove('show'), 4800)
  }
}

new DawnfallApp()
