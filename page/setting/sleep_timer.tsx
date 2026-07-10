import {
  useState,
  useEffect,
  List,
  Section,
  VStack,
  HStack,
  Text,
  Button,
  Spacer,
  Image,
  Label,
  Form,
  TextField,
  Picker,
  Stepper,
  NavigationStack,
  Navigation,
} from "scripting"
import { sleepTimerManager, SleepTimer, SleepTimerMode } from "../../class/sleep_timer"

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}秒`
  if (s === 0) return `${m}分钟`
  return `${m}分${s}秒`
}

function timerDesc(timer: SleepTimer): string {
  return timer.mode === "time"
    ? `${timer.value} 分钟后停止`
    : `再播放 ${timer.value} 首后停止`
}

function AddTimerView({ onDone }: { onDone: () => void }) {
  const dismiss = Navigation.useDismiss()
  const [name, setName] = useState("")
  const [mode, setMode] = useState<SleepTimerMode>("time")
  const [value, setValue] = useState(30)

  const isValid = name.trim().length > 0
  const maxValue = mode === "time" ? 180 : 50
  const step = mode === "time" ? 5 : 1

  function save() {
    if (!isValid) return
    sleepTimerManager.addTimer({ name: name.trim(), mode, value })
    onDone()
    dismiss()
  }

  return (
    <NavigationStack>
      <Form
        navigationTitle="新建定时器"
        toolbar={{
          cancellationAction: <Button title="取消" action={dismiss} />,
          primaryAction: <Button title="保存" action={save} disabled={!isValid} />,
        }}
      >
        <Section header={<Text>名称</Text>}>
          <TextField
            title="定时器名称"
            value={name}
            onChanged={setName}
          />
        </Section>

        <Section header={<Text>停止方式</Text>}>
          <Picker
            title="方式"
            value={mode}
            onChanged={(v: string) => {
              const m = v as SleepTimerMode
              setMode(m)
              setValue(m === "time" ? 30 : 5)
            }}
          >
            <Text tag="time">按时间</Text>
            <Text tag="songs">按曲数</Text>
          </Picker>
        </Section>

        <Section header={<Text>{mode === "time" ? "时长（分钟）" : "曲数"}</Text>}>
          <Stepper
            onIncrement={() => setValue(v => Math.min(v + step, maxValue))}
            onDecrement={() => setValue(v => Math.max(v - step, 1))}
          >
            <Text>{mode === "time" ? `${value} 分钟` : `${value} 首`}</Text>
          </Stepper>
        </Section>
      </Form>
    </NavigationStack>
  )
}

export function SleepTimerPage() {
  const [, setTick] = useState(0)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    return sleepTimerManager.subscribe(() => setTick(t => t + 1))
  }, [])

  const timers = sleepTimerManager.getTimers()
  const active = sleepTimerManager.getActive()
  const activeTimer = sleepTimerManager.getActiveTimer()

  return (
    <List
      navigationTitle="睡眠定时器"
      sheet={{
        isPresented: showAdd,
        onChanged: setShowAdd,
        content: <AddTimerView onDone={() => setShowAdd(false)} />,
      }}
    >
      {activeTimer != null && (
        <Section header={<Text>当前激活</Text>}>
          <HStack>
            <Image systemName="moon.zzz.fill" foregroundStyle="purple" />
            <VStack alignment="leading" spacing={2}>
              <Text font="headline">{activeTimer.name}</Text>
              <Text font="caption" foregroundStyle="secondaryLabel">
                {activeTimer.mode === "time"
                  ? `剩余 ${formatRemaining(sleepTimerManager.getRemainingSeconds())}`
                  : `还剩 ${sleepTimerManager.getRemainingSongs()} 首`}
              </Text>
            </VStack>
            <Spacer />
            <Button title="取消" role="destructive" action={() => sleepTimerManager.cancel()} />
          </HStack>
        </Section>
      )}

      <Section
        header={<Text>我的定时器</Text>}
        footer={
          <Text>
            {timers.length === 0
              ? "点击下方按钮创建定时器，同时只能激活一个。"
              : "点击定时器激活或取消，触发后自动失效。"}
          </Text>
        }
      >
        {timers.map(timer => (
          <HStack
            key={timer.id}
            onTapGesture={() => {
              if (active?.timerId === timer.id) {
                sleepTimerManager.cancel()
              } else {
                sleepTimerManager.activate(timer.id)
              }
            }}
            trailingSwipeActions={{
              actions: [
                <Button
                  title="删除"
                  role="destructive"
                  action={() => sleepTimerManager.deleteTimer(timer.id)}
                />,
              ],
            }}
          >
            <VStack alignment="leading" spacing={2}>
              <Text>{timer.name}</Text>
              <Text font="caption" foregroundStyle="secondaryLabel">
                {timerDesc(timer)}
              </Text>
            </VStack>
            <Spacer />
            {active?.timerId === timer.id && (
              <Image systemName="checkmark.circle.fill" foregroundStyle="green" />
            )}
          </HStack>
        ))}
        <Button action={() => setShowAdd(true)}>
          <Label title="新建定时器" systemImage="plus.circle.fill" />
        </Button>
      </Section>
    </List>
  )
}