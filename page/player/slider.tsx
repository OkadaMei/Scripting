import { HStack, Slider, Spacer, Text, useObservable, useState, useEffect, useRef, VStack } from "scripting"
import { usePlayerProgress } from "../../class/player_state"
import { player } from "../../class/player"

export function ProgressSlider() {
  const { currentTime, duration } = usePlayerProgress()
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const value = useObservable<number>(currentTime)
  const lastUpdateTime = useRef(Date.now())

  useEffect(() => {
    if (!isDraggingRef.current) {
      value.setValue(currentTime)
    }
  }, [currentTime])

  return (
    <VStack
      spacing={10}
      padding={16}
      background={{
        style: "ultraThinMaterial",
        shape: { type: "rect", cornerRadius: 22 },
      }}
    >
      <Slider
        min={0}
        max={duration || 180}
        value={value}
        onEditingChanged={(editing) => {
          const now = Date.now()
          const delta = now - lastUpdateTime.current
          lastUpdateTime.current = now

          if (editing && delta < 100) {
            return
          }

          isDraggingRef.current = editing
          setIsDragging(editing)
          if (!editing) {
            player.seek(value.value)
          }
        }}
        tint="systemPink"
      />
      <SliderDesc currentTime={isDragging ? value.value : currentTime} duration={duration} />
    </VStack>
  )
}

function SliderDesc({ currentTime, duration }: { currentTime: number, duration: number }) {
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <HStack foregroundStyle="rgba(255,255,255,0.72)" font="footnote">
      <Text>{formatTime(currentTime)}</Text>
      <Spacer />
      <Text>{formatTime(duration)}</Text>
    </HStack>
  )
}
