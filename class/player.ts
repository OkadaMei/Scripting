import { Widget } from "scripting"
import { database, Music } from "./database"
import { fileManager } from "./file_manager"
import { sleepTimerManager } from "./sleep_timer"

type PlayMode = "sequential" | "shuffle" | "repeat-one" | "repeat-all"
type PlayerState = "idle" | "loading" | "playing" | "paused" | "error"

type PlayerEvent = {
  onStateChange?: (state: PlayerState) => void
  onMusicChange?: (music: Music | null) => void
  onProgressChange?: (current: number, duration: number) => void
  onQueueChange?: (queue: Music[]) => void
  onPlayModeChange?: (mode: PlayMode) => void
  onError?: (error: string) => void
}

class Player {
  private player: AVPlayer | null = null
  private currentMusic: Music | null = null
  private queue: Music[] = []
  private currentIndex: number = -1
  private playMode: PlayMode = "sequential"
  private state: PlayerState = "idle"
  private listeners: PlayerEvent[] = []
  private progressTimer: number | null = null
  private isTimerRunning: boolean = false
  private hasCountedPlay: boolean = false
  private initialized: boolean = false

  private static readonly STORAGE_QUEUE_KEY = "player_queue"
  private static readonly STORAGE_INDEX_KEY = "player_index"
  private static readonly STORAGE_MUSIC_KEY = "player_current_music"
  private static readonly STORAGE_PLAY_MODE_KEY = "player_play_mode"

  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    await fileManager.init()
    await database.init()

    this.player = new AVPlayer()

    this.player.onReadyToPlay = () => {
      console.log(`[Player] 音频准备完成，开始播放`, this.player?.duration)
      this.setState("playing")
      this.player?.play()
      const dur = this.player?.duration ?? 0
      if (isFinite(dur) && dur > 0) {
        this.listeners.forEach(l => l.onProgressChange?.(0, dur))
        if (this.currentMusic && (!this.currentMusic.duration || this.currentMusic.duration === 0)) {
          this.currentMusic = { ...this.currentMusic, duration: dur }
        }
      }this.startProgressTimer()
      this.updateNowPlayingInfo()
      this.saveNowPlayingToStorage(this.currentMusic)
      sleepTimerManager.onSongStarted()
    }

    this.player.onEnded = () => {
      this.handlePlaybackEnded()}

    this.player.onError = (message) => {
      this.setState("error")
      this.listeners.forEach(l => l.onError?.(message))
    }

    SharedAudioSession.setCategory("playback", ["allowBluetoothA2DP", "allowAirPlay"])
    SharedAudioSession.setActive(true)

    this.setupInterruptionHandling()
    this.setupMediaPlayerCommands()
    sleepTimerManager.setTriggerCallback(() => this.pause())
    this.restoreSession()
  }

  private restoreSession(): void {
    const queue = Storage.get<Music[]>(Player.STORAGE_QUEUE_KEY)
    const index = Storage.get<number>(Player.STORAGE_INDEX_KEY)
    const music = Storage.get<Music>(Player.STORAGE_MUSIC_KEY)
    if (queue && queue.length > 0 && index !== null) {
      this.queue = queue
      this.currentIndex = index
      this.listeners.forEach(l => l.onQueueChange?.(queue))}
    if (music) {
      this.currentMusic = music
      this.listeners.forEach(l => l.onMusicChange?.(music))
    }const savedMode = Storage.get<PlayMode>(Player.STORAGE_PLAY_MODE_KEY)
    if (savedMode) this.playMode = savedMode
  }

  on(events: PlayerEvent): () => void {
    this.listeners.push(events)
    return () => {
      this.listeners = this.listeners.filter(l => l !== events)
    }
  }

  async play(music?: Music): Promise<void> {
    if (music) {
      console.log(`[Player] 开始播放: ${music.title}`)
      await this.playMusic(music)
    } else if (this.state === "paused") {
      console.log(`[Player] 恢复播放`)
      this.player?.play()
      this.setState("playing")
      this.startProgressTimer()
      await this.updateNowPlayingInfo()
      await this.saveNowPlayingToStorage(this.currentMusic)
    } else if (this.state === "idle" && this.currentMusic) {
      console.log(`[Player] 重新播放: ${this.currentMusic.title}`)
      await this.playMusic(this.currentMusic)
    }
  }

  async pause(): Promise<void> {
    console.log(`[Player] 暂停播放`)
    this.player?.pause()
    this.setState("paused")
    this.stopProgressTimer()
    MediaPlayer.playbackState = MediaPlayerPlaybackState.paused
    this.updateNowPlayingInfo()
    await this.saveNowPlayingToStorage(this.currentMusic)
  }

  stop(): void {
    this.player?.stop()
    this.setState("idle")
    this.stopProgressTimer()
    this.currentMusic = null
    this.listeners.forEach(l => l.onMusicChange?.(null))
    MediaPlayer.nowPlayingInfo = null
  }

  async next(): Promise<void> {
    const nextIndex = this.getNextIndex()
    if (nextIndex !== -1) {
      await this.playAtIndex(nextIndex)
    }
  }

  async previous(): Promise<void> {
    const prevIndex = this.getPreviousIndex()
    if (prevIndex !== -1) {
      await this.playAtIndex(prevIndex)
    }
  }

  seek(time: number): void {
    if (this.player) {
      // Stop timer first to prevent stale currentTime from overwriting seek position
      this.stopProgressTimer()
      this.player.currentTime = time
      // Immediately notify so UI reflects new position
      this.listeners.forEach(l => l.onProgressChange?.(time, this.player!.duration))
      // Restart timer if still playing, delay first tick so AVPlayer seek completes first
            if (this.state === "playing") {
              this.startProgressTimer(true)
            }
    }
  }

  setQueue(queue: Music[], startIndex: number = 0): void {
    this.queue = queue
    this.currentIndex = startIndex
    this.listeners.forEach(l => l.onQueueChange?.(queue))
    Storage.set(Player.STORAGE_QUEUE_KEY, queue)
    Storage.set(Player.STORAGE_INDEX_KEY, startIndex)
  }

  addToQueue(music: Music): void {
    this.queue.push(music)
    this.listeners.forEach(l => l.onQueueChange?.(this.queue))
  }

  async playNext(music: Music): Promise<void> {
    const insertIndex = this.currentIndex < 0 ? 0 : this.currentIndex + 1
    this.queue.splice(insertIndex, 0, music)
    this.currentIndex = insertIndex
    Storage.set(Player.STORAGE_QUEUE_KEY, this.queue)
    Storage.set(Player.STORAGE_INDEX_KEY, this.currentIndex)
    this.listeners.forEach(l => l.onQueueChange?.(this.queue))
    await this.playMusic(music)
  }

  setPlayMode(mode: PlayMode): void {
    this.playMode = mode
    Storage.set(Player.STORAGE_PLAY_MODE_KEY, mode)
    this.listeners.forEach(l => l.onPlayModeChange?.(mode))
  }

  getState(): PlayerState {
    return this.state
  }

  getCurrentMusic(): Music | null {
    return this.currentMusic
  }

  getQueue(): Music[] {
    return this.queue
  }

  getPlayMode(): PlayMode {
    return this.playMode
  }

  getCurrentIndex(): number {
    return this.currentIndex
  }

  getCurrentTime(): number {
    return this.player?.currentTime ?? 0
  }

  getDuration(): number {
    return this.player?.duration ?? 0
  }

  dispose(): void {
    this.stopProgressTimer()
    this.player?.dispose()
    this.player = null
    this.currentMusic = null
    this.queue = []
    this.currentIndex = -1
    this.listeners = []
    MediaPlayer.nowPlayingInfo = null
  }

  private async saveNowPlayingToStorage(music: Music | null): Promise<void> {
    if (music) {
      const coverPath = fileManager.getCoverPath(music.id)
      const hasCover = await FileManager.exists(coverPath)
      const loops = this.playMode === "repeat-all" || this.playMode === "shuffle"
      Storage.set("now_playing", {
        title: music.title,
        artist: music.artist,
        cover_url: music.cover_url ?? "",
        cover_path: hasCover ? coverPath : "",
        is_playing: this.state === "playing",
        can_prev: loops || this.currentIndex > 0,
        can_next: loops || this.currentIndex < this.queue.length - 1
      })
    } else {
      Storage.remove("now_playing")
    }Widget.reloadUserWidgets()
  }

  private async playMusic(music: Music): Promise<void> {
    this.setState("loading")
    this.currentMusic = music
    this.hasCountedPlay = false
    this.listeners.forEach(l => l.onMusicChange?.(music))
    this.saveNowPlayingToStorage(music)
    Storage.set(Player.STORAGE_MUSIC_KEY, music)
    Storage.set(Player.STORAGE_INDEX_KEY, this.currentIndex)

    let audioUrl: string | undefined

    console.log(`[Player] is_downloaded=${music.is_downloaded}, audio_url=${music.audio_url}`)

    if (music.is_downloaded) {
      const localPath = await fileManager.findAudioPath(music.id)
      const exists = localPath !== null
      console.log(`[Player] 本地路径: ${localPath}, 存在: ${exists}`)
      if (exists) {
        audioUrl = localPath!
      } else {
        console.log(`[Player] 本地文件不存在，尝试使用在线地址`)
        audioUrl = music.audio_url
        if (!audioUrl) {
          this.setState("error")
          this.currentMusic = null
          this.listeners.forEach(l => l.onMusicChange?.(null))
          this.listeners.forEach(l => l.onError?.("本地文件不存在且无在线播放地址"))
          return
        }
      }
    } else {
      audioUrl = music.audio_url
      if (!audioUrl) {
        this.setState("error")
        this.currentMusic = null
        this.listeners.forEach(l => l.onMusicChange?.(null))
        this.listeners.forEach(l => l.onError?.("无可用的播放地址"))
        return
      }
    }

    console.log(`[Player] setSource: ${audioUrl}, player实例: ${this.player !== null}`)
    const success = this.player?.setSource(audioUrl)
    console.log(`[Player] setSource result: ${success}, onReadyToPlay已注册: ${this.player?.onReadyToPlay !== undefined}`)
    if (!success) {
      this.setState("error")
      this.listeners.forEach(l => l.onError?.("Failed to load audio"))
      return
    }

    await database.updateMusicPlayCount(music.id)
  }

  private async playAtIndex(index: number): Promise<void> {
    if (index >= 0 && index < this.queue.length) {
      this.currentIndex = index
      Storage.set(Player.STORAGE_INDEX_KEY, index)
      this.listeners.forEach(l => l.onQueueChange?.(this.queue))
      await this.playMusic(this.queue[index])
    }
  }

  private handlePlaybackEnded(): void {
    this.stopProgressTimer()

    if (this.playMode === "repeat-one") {
      this.player?.play()
      this.startProgressTimer()
      return
    }

    const nextIndex = this.getNextIndex()
    if (nextIndex !== -1) {
      this.playAtIndex(nextIndex)
    } else {
      this.setState("idle")
    }
  }

  private getNextIndex(): number {
    if (this.queue.length === 0) return -1
    if (this.playMode === "shuffle") {
      return Math.floor(Math.random() * this.queue.length)
    }
    const next = this.currentIndex + 1
    if (next < this.queue.length) return next
    return this.playMode === "repeat-all" ? 0 : -1
  }

  private getPreviousIndex(): number {
    if (this.queue.length === 0) return -1
    if (this.playMode === "shuffle") {
      return Math.floor(Math.random() * this.queue.length)
    }
    const prev = this.currentIndex - 1
    if (prev >= 0) return prev
    return this.playMode === "repeat-all" ? this.queue.length - 1 : -1
  }

  private setState(state: PlayerState): void {
    this.state = state
    this.listeners.forEach(l => l.onStateChange?.(state))
    if (state === "playing") {
      MediaPlayer.playbackState = MediaPlayerPlaybackState.playing
    } else if (state === "paused") {
      MediaPlayer.playbackState = MediaPlayerPlaybackState.paused
    }
  }

  private async updateNowPlayingInfo(): Promise<void> {
    if (!this.currentMusic) return

    const info: NowPlayingInfo = {
      title: this.currentMusic.title,
      artist: this.currentMusic.artist,
      albumTitle: this.currentMusic.album,
      playbackRate: this.state === "playing" ? 1.0 : 0.0,
      elapsedPlaybackTime: this.player?.currentTime ?? 0,
      playbackDuration: this.currentMusic.duration
    }

    try {
      const coverPath = fileManager.getCoverPath(this.currentMusic.id)
      if (await FileManager.exists(coverPath)) {
        const artwork = UIImage.fromFile(coverPath)
        if (artwork) info.artwork = artwork
      } else if (this.currentMusic.cover_url) {
        const artwork = await UIImage.fromURL(this.currentMusic.cover_url)
        if (artwork) info.artwork = artwork
      }
    } catch (error) {
      console.log(`[NowPlaying] 加载封面失败:`, error)
    }

    MediaPlayer.nowPlayingInfo = info
  }

  private setupInterruptionHandling(): void {
    SharedAudioSession.addInterruptionListener((type) => {
      if (type === "began") {
        this.pause()
      } else if (type === "ended") {
        if (this.state === "paused" && this.currentMusic) {
          this.play()
        }
      }
    })
  }

  private setupMediaPlayerCommands(): void {
    MediaPlayer.setAvailableCommands([
      "togglePausePlay", "nextTrack", "previousTrack", "seekForward", "play", "pause", "seekBackward"
    ])

    MediaPlayer.commandHandler = (command: MediaPlayerRemoteCommand) => {
      switch (command) {
        case "play": this.play(); break
        case "pause": this.pause(); break
        case "nextTrack": this.next(); break
        case "previousTrack": this.previous(); break
        case "seekForward": this.seek(this.getCurrentTime() + 15); break
        case "seekBackward": this.seek(this.getCurrentTime() - 15); break
      }
    }
  }

  private startProgressTimer(delayFirstTick: boolean = false): void {
      this.stopProgressTimer()
      this.isTimerRunning = true
      const tick = () => {
        if (this.player && this.state === "playing") {
          this.listeners.forEach(l => l.onProgressChange?.(this.player!.currentTime, this.player!.duration))
          this.checkPlayCompletion()
        }
        if (this.isTimerRunning) {
          this.progressTimer = setTimeout(tick, 1000)
        }
      }
      if (delayFirstTick) {
        this.progressTimer = setTimeout(tick, 1000)
      } else {
        tick()
      }
    }

  private stopProgressTimer(): void {
    this.isTimerRunning = false
    if (this.progressTimer !== null) {
      clearTimeout(this.progressTimer)
      this.progressTimer = null
    }
  }

  private checkPlayCompletion(): void {
    if (!this.player || !this.currentMusic || this.hasCountedPlay) return
    const progress = this.player.currentTime / this.player.duration
    if (progress >= 0.8) {
      this.hasCountedPlay = true
      database.updateMusicPlayCount(this.currentMusic.id)
    }
  }
}

export const player = new Player()
export type { PlayMode, PlayerState, PlayerEvent }