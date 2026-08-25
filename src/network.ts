import Peer, { type DataConnection } from 'peerjs'
import type { GameSnapshot, InputState, PlayerConfig } from './game/types'

type NetworkMessage =
  | { type: 'lobby'; players: PlayerConfig[] }
  | { type: 'config'; config: PlayerConfig }
  | { type: 'input'; playerId: string; input: InputState }
  | { type: 'start'; configs: PlayerConfig[]; duration: number; seed: number }
  | { type: 'snapshot'; snapshot: GameSnapshot }
  | { type: 'upgrade'; playerId: string; upgradeId: string }
  | { type: 'notice'; text: string }

export interface NetworkCallbacks {
  onLobby(players: PlayerConfig[]): void
  onStart(configs: PlayerConfig[], duration: number, seed: number): void
  onSnapshot(snapshot: GameSnapshot): void
  onGuestInput(playerId: string, input: InputState): void
  onUpgrade(playerId: string, upgradeId: string): void
  onNotice(text: string): void
  onError(message: string): void
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SNAPSHOT_BUFFER_LIMIT = 512 * 1024
const createCode = () => Array.from({ length: 6 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join('')
const peerIdForRoom = (code: string) => `dawnfall-${code.trim().toLowerCase()}`

const isPlayerConfig = (value: unknown): value is PlayerConfig => {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<PlayerConfig>
  return typeof config.id === 'string' && typeof config.name === 'string' && typeof config.character === 'string' && typeof config.weapon === 'string'
}

export class MultiplayerSession {
  roomCode = ''
  isHost = false
  players: PlayerConfig[] = []
  private peer?: Peer
  private hostConnection?: DataConnection
  private readonly guestConnections = new Map<string, DataConnection>()
  private readonly callbacks: NetworkCallbacks

  constructor(callbacks: NetworkCallbacks) {
    this.callbacks = callbacks
  }

  async host(config: PlayerConfig): Promise<string> {
    this.close()
    this.isHost = true
    this.players = [config]
    const code = createCode()
    this.roomCode = code
    const peer = new Peer(peerIdForRoom(code), { secure: true, debug: 0 })
    this.peer = peer
    await this.waitForPeerOpen(peer)

    peer.on('connection', (connection) => this.acceptGuest(connection))
    peer.on('error', (error) => this.callbacks.onError(this.friendlyPeerError(error.type)))
    this.callbacks.onLobby([...this.players])
    return code
  }

  async join(code: string, config: PlayerConfig): Promise<void> {
    this.close()
    this.isHost = false
    this.roomCode = code.trim().toUpperCase()
    this.players = [config]
    const peer = new Peer({ secure: true, debug: 0 })
    this.peer = peer
    await this.waitForPeerOpen(peer)

    const connection = peer.connect(peerIdForRoom(code), {
      reliable: true,
      serialization: 'binary',
      metadata: config,
    })
    this.hostConnection = connection
    await this.waitForConnectionOpen(connection)
    connection.on('data', (data) => this.handleGuestMessage(data as NetworkMessage))
    connection.on('close', () => this.callbacks.onError('The host closed the squad room.'))
    connection.on('error', () => this.callbacks.onError('The direct connection to the host failed.'))
    connection.send({ type: 'config', config } satisfies NetworkMessage)
  }

  updateConfig(config: PlayerConfig) {
    if (this.isHost) {
      this.players = this.players.map((player) => (player.id === config.id ? config : player))
      this.broadcastLobby()
    } else if (this.hostConnection?.open) {
      this.hostConnection.send({ type: 'config', config } satisfies NetworkMessage)
    }
  }

  startGame(duration: number, seed: number) {
    if (!this.isHost) return
    this.broadcast({ type: 'start', configs: [...this.players], duration, seed })
  }

  sendInput(playerId: string, input: InputState) {
    if (!this.isHost && this.hostConnection?.open) {
      this.hostConnection.send({ type: 'input', playerId, input } satisfies NetworkMessage)
    }
  }

  sendUpgrade(playerId: string, upgradeId: string) {
    if (!this.isHost && this.hostConnection?.open) {
      this.hostConnection.send({ type: 'upgrade', playerId, upgradeId } satisfies NetworkMessage)
    }
  }

  broadcastSnapshot(snapshot: GameSnapshot) {
    if (!this.isHost) return
    const message = { type: 'snapshot', snapshot } satisfies NetworkMessage
    for (const connection of this.guestConnections.values()) {
      // Snapshots are disposable authoritative frames. Never put a newer world
      // state behind stale frames on a slower guest connection.
      if (connection.open && this.snapshotQueueIsClear(connection)) connection.send(message)
    }
  }

  close() {
    this.hostConnection?.close()
    this.hostConnection = undefined
    for (const connection of this.guestConnections.values()) connection.close()
    this.guestConnections.clear()
    this.peer?.destroy()
    this.peer = undefined
    this.players = []
    this.roomCode = ''
    this.isHost = false
  }

  private acceptGuest(connection: DataConnection) {
    const config = connection.metadata
    if (!isPlayerConfig(config)) {
      connection.close()
      return
    }
    if (this.players.length >= 4) {
      connection.on('open', () => {
        connection.send({ type: 'notice', text: 'That squad is already full.' } satisfies NetworkMessage)
        connection.close()
      })
      return
    }

    this.guestConnections.set(config.id, connection)
    this.players = [...this.players.filter((player) => player.id !== config.id), config]
    connection.on('open', () => this.broadcastLobby())
    connection.on('data', (data) => this.handleHostMessage(data as NetworkMessage, config.id))
    connection.on('close', () => {
      this.guestConnections.delete(config.id)
      this.players = this.players.filter((player) => player.id !== config.id)
      this.broadcastLobby()
    })
    connection.on('error', () => this.callbacks.onNotice(`${config.name} lost their direct connection.`))
  }

  private handleHostMessage(message: NetworkMessage, connectionPlayerId: string) {
    if (!message || typeof message !== 'object') return
    if (message.type === 'config' && isPlayerConfig(message.config) && message.config.id === connectionPlayerId) {
      this.players = this.players.map((player) => (player.id === connectionPlayerId ? message.config : player))
      this.broadcastLobby()
    } else if (message.type === 'input' && message.playerId === connectionPlayerId) {
      this.callbacks.onGuestInput(message.playerId, message.input)
    } else if (message.type === 'upgrade' && message.playerId === connectionPlayerId) {
      this.callbacks.onUpgrade(message.playerId, message.upgradeId)
    }
  }

  private handleGuestMessage(message: NetworkMessage) {
    if (!message || typeof message !== 'object') return
    if (message.type === 'lobby') {
      this.players = message.players
      this.callbacks.onLobby([...message.players])
    } else if (message.type === 'start') {
      this.callbacks.onStart(message.configs, message.duration, message.seed)
    } else if (message.type === 'snapshot') {
      this.callbacks.onSnapshot(message.snapshot)
    } else if (message.type === 'notice') {
      this.callbacks.onNotice(message.text)
    }
  }

  private broadcastLobby() {
    this.callbacks.onLobby([...this.players])
    this.broadcast({ type: 'lobby', players: [...this.players] })
  }

  private broadcast(message: NetworkMessage) {
    for (const connection of this.guestConnections.values()) if (connection.open) connection.send(message)
  }

  private snapshotQueueIsClear(connection: DataConnection): boolean {
    const queuedMessages = (connection as unknown as { bufferSize?: number }).bufferSize ?? 0
    const bufferedBytes = (connection as unknown as { dataChannel?: RTCDataChannel }).dataChannel?.bufferedAmount ?? 0
    return queuedMessages === 0 && bufferedBytes < SNAPSHOT_BUFFER_LIMIT
  }

  private waitForPeerOpen(peer: Peer): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('The matchmaking service did not respond.')), 9000)
      peer.once('open', (id) => {
        window.clearTimeout(timeout)
        resolve(id)
      })
      peer.once('error', (error) => {
        window.clearTimeout(timeout)
        reject(new Error(this.friendlyPeerError(error.type)))
      })
    })
  }

  private waitForConnectionOpen(connection: DataConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('No room answered that code. Check it and try again.')), 9000)
      connection.once('open', () => {
        window.clearTimeout(timeout)
        resolve()
      })
      connection.once('error', () => {
        window.clearTimeout(timeout)
        reject(new Error('The direct WebRTC connection could not be established.'))
      })
    })
  }

  private friendlyPeerError(type: string): string {
    if (type === 'unavailable-id') return 'That room code is already occupied. Try hosting again.'
    if (type === 'peer-unavailable') return 'No room answered that code. Check it and try again.'
    if (type === 'network' || type === 'server-error' || type === 'socket-error') return 'The matchmaking service is temporarily unreachable.'
    return 'The direct multiplayer connection failed. Try again on a different network.'
  }
}
