export type SleepTimerMode = "time" | "songs"

export type SleepTimer = {
  id: string
  name: string
  mode: SleepTimerMode
  value: number // minutes (time) or song count (songs)
}

type ActiveState = {
  timerId: string
  endsAt: number        // ms timestamp, time mode only
  songsRemaining: number // songs mode only
}

type Listener = () => void

const STORAGE_KEY = "sleep_timers"

class SleepTimerManager {
  private timers: SleepTimer[] = Storage.get<SleepTimer[]>(STORAGE_KEY) ?? []
  private active: ActiveState | null = null
  private tickTimer: number | null = null
  private listeners: Set<Listener> = new Set()
  private triggerCallback: (() => void) | null = null

  private save() {
    Storage.set(STORAGE_KEY, this.timers)
  }

  private notify() {
    this.listeners.forEach(l => l())
  }

  private clearTick() {
    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer)
      this.tickTimer = null
    }
  }

  private scheduleTick() {
    this.clearTick()
    const tick = () => {
      if (!this.active?.endsAt) return
      if (Date.now() >= this.active.endsAt) {
        this.trigger()
      } else {
        this.notify()
        this.tickTimer = setTimeout(tick, 10_000)
      }
    }
    this.tickTimer = setTimeout(tick, 10_000)
  }

  private trigger() {
    this.clearTick()
    this.active = null
    this.notify()
    this.triggerCallback?.()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setTriggerCallback(fn: () => void) {
    this.triggerCallback = fn
  }

  /** Called by Player when a new song starts playing */
  onSongStarted() {
    if (!this.active) return
    const timer = this.timers.find(t => t.id === this.active!.timerId)
    if (!timer || timer.mode !== "songs") return
    this.active.songsRemaining -= 1
    if (this.active.songsRemaining <= 0) {
      this.trigger()
    } else {
      this.notify()}
  }

  activate(timerId: string) {
    const timer = this.timers.find(t => t.id === timerId)
    if (!timer) return
    this.clearTick()
    if (timer.mode === "time") {
      this.active = { timerId, endsAt: Date.now() + timer.value * 60_000, songsRemaining: 0 }
      this.scheduleTick()
    } else {
      this.active = { timerId, endsAt: 0, songsRemaining: timer.value }
    }
    this.notify()
  }

  cancel() {
    this.clearTick()
    this.active = null
    this.notify()}

  getTimers(): SleepTimer[] { return this.timers }
  getActive(): ActiveState | null { return this.active }

  getActiveTimer(): SleepTimer | null {
    if (!this.active) return null
    return this.timers.find(t => t.id === this.active!.timerId) ?? null
  }

  getRemainingSeconds(): number {
    if (!this.active?.endsAt) return 0
    return Math.max(0, Math.ceil((this.active.endsAt - Date.now()) / 1000))
  }

  getRemainingSongs(): number {
    return this.active?.songsRemaining ?? 0
  }

  addTimer(data: Omit<SleepTimer, "id">): SleepTimer {
    const t: SleepTimer = { ...data, id: Date.now().toString() }
    this.timers = [...this.timers, t]
    this.save()
    this.notify()
    return t
  }

  deleteTimer(id: string) {
    if (this.active?.timerId === id) this.cancel()
    this.timers = this.timers.filter(t => t.id !== id)
    this.save()
    this.notify()
  }
}

export const sleepTimerManager = new SleepTimerManager()