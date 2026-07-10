import { createContext, useObservable, useEffect, useContext } from "scripting"
import { player, PlayerState, PlayMode } from "./player"
import { Music } from "./database"

type PlayerStateData = {
  state: PlayerState
  currentMusic: Music | null
  queue: Music[]
  isPlaying: boolean
  playMode: PlayMode
  currentIndex: number
}

type PlayerProgressData = {
  currentTime: number
  duration: number
}

const initialState: PlayerStateData = {
  state: "idle",
  currentMusic: null,
  queue: [],
  isPlaying: false,
  playMode: "sequential",
  currentIndex: -1
}

const initialProgress: PlayerProgressData = {
  currentTime: 0,
  duration: 0
}

const PlayerStateContext = createContext<PlayerStateData>()
const PlayerProgressContext = createContext<PlayerProgressData>()

export function PlayerStateProvider({ children }: { children: JSX.Element }) {
  const state = useObservable<PlayerStateData>(initialState)

  useEffect(() => {
    const currentMusic = player.getCurrentMusic()
    const queue = player.getQueue()
    if (currentMusic || queue.length > 0) {
      state.setValue({
        state: player.getState(),
        currentMusic,
        queue,
        isPlaying: player.getState() === "playing",
        playMode: player.getPlayMode(),
        currentIndex: player.getCurrentIndex()
      })
    }

    const unsubscribe = player.on({
      onStateChange: (newState) => {
        state.setValue({
          ...state.value,
          state: newState,
          isPlaying: newState === "playing"
        })
      },
      onMusicChange: (music) => {
        state.setValue({
          ...state.value,
          currentMusic: music
        })
      },
      onQueueChange: (queue) => {
        state.setValue({
          ...state.value,
          queue,
          currentIndex: player.getCurrentIndex()
        })
      },
      onPlayModeChange: (playMode) => {
        state.setValue({
          ...state.value,
          playMode
        })
      }
    })

    return unsubscribe
  }, [])

  return (
    <PlayerStateContext.Provider value={state.value}>
      {children}
    </PlayerStateContext.Provider>
  )
}

export function PlayerProgressProvider({ children }: { children: JSX.Element }) {
  const progress = useObservable<PlayerProgressData>(initialProgress)

  useEffect(() => {
    const unsubscribe = player.on({
      onMusicChange: (music) => {
        progress.setValue({
          currentTime: 0,
          duration: music?.duration ?? 0
        })
      },
      onProgressChange: (current, dur) => {
        const validDuration = isFinite(dur) && dur > 0 ? dur : progress.value.duration
        progress.setValue({ currentTime: current, duration: validDuration })
      }
    })
    return unsubscribe
  }, [])

  return (
    <PlayerProgressContext.Provider value={progress.value}>
      {children}
    </PlayerProgressContext.Provider>
  )
}

export function usePlayerState(): PlayerStateData {
  return useContext(PlayerStateContext)
}

export function usePlayerProgress(): PlayerProgressData {
  return useContext(PlayerProgressContext)
}