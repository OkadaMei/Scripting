import { AppIntentManager, AppIntentProtocol, Navigation, Script, Widget } from "scripting"
import { getBangumiAppState, setBangumiAppState } from "./page/bangumi/client"
import { HomePage } from "./page"

let cancel: Function | null

cancel = Script.onResume(async () => {
  // 只注册一次，避免 resume 监听在交互式小组件场景重复挂载。
  setTimeout(() => {
    cancel?.()
    cancel = null
  }, 1000)

  try {
    await Navigation.present({
      element: <HomePage />,
      modalPresentationStyle: "overFullScreen"
    })
    Script.exit()
  } catch (e) {
    console.present().then(Script.exit)
    console.error(e)
  }
})

export const ToggleBangumiThemeFollowSystemIntent = AppIntentManager.register({
  name: "ToggleBangumiThemeFollowSystemIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    const current = getBangumiAppState()
    const nextFollowSystem = current.appearanceMode !== "system"
    setBangumiAppState({
      ...current,
      appearanceMode: nextFollowSystem ? "system" : current.manualAppearanceMode,
    })
    Widget.reloadUserWidgets()
  },
})

export const ToggleBangumiIsolationModeIntent = AppIntentManager.register({
  name: "ToggleBangumiIsolationModeIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    const current = getBangumiAppState()
    setBangumiAppState({
      ...current,
      isolationMode: !current.isolationMode,
    })
    Widget.reloadUserWidgets()
  },
})