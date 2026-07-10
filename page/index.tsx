import {
  Button,
  Image,
  Navigation,
  NavigationStack,
  Script,
  Tab,
  TabView,
  Toolbar,
  ToolbarItem,
  useEffect,
  useObservable,
} from "scripting"
import { LibraryView } from "./library"
import { SavedView } from "./saved"
import { DownloadView } from "./download"
import { SearchView } from "./search"
import { SettingView } from "./setting"

export function HomePage() {
  const selection = useObservable<number>(1)
  const dismissView = Navigation.useDismiss()
  const supportsMinimization = Script.supportsMinimization()

  function handleClose() {
    dismissView("close")
  }

  async function handleMinimize() {
    if (!supportsMinimization) return
    if (Script.isMinimized()) return

    const success = await Script.minimize()
    if (!success) {
      console.log("GiriGiri 最小化未执行")
    }
  }

  useEffect(() => {
    const removeResume = Script.onResume((details) => {
      if (details.resumeFromMinimized) {
        console.log("GiriGiri 从最小化恢复")
      }
    })

    return () => {
      removeResume()
    }
  }, [])

  const chromeToolbar = (
    <Toolbar>
      <ToolbarItem placement="topBarLeading" sharedBackgroundVisibility="visible">
        <Button action={handleClose} buttonStyle="plain">
          <Image systemName="xmark" font="headline" foregroundStyle="label" />
        </Button>
      </ToolbarItem>

      {supportsMinimization && (
        <ToolbarItem placement="topBarTrailing" sharedBackgroundVisibility="visible">
          <Button action={handleMinimize} buttonStyle="plain">
            <Image systemName="arrow.down.right.and.arrow.up.left" font="headline" foregroundStyle="label" />
          </Button>
        </ToolbarItem>
      )}
    </Toolbar>
  )

  return (
    <NavigationStack>
      <TabView
        selection={selection}
        tint="systemPink"
        tabViewStyle="sidebarAdaptable"
        tabBarMinimizeBehavior="onScrollDown"
        toolbar={chromeToolbar}
      >
        <Tab title="浏览" systemImage="house.fill" value={1}>
          <LibraryView />
        </Tab>

        <Tab title="搜索" systemImage="magnifyingglass" value={0}>
          <SearchView />
        </Tab>

        <Tab title="收藏" systemImage="heart.fill" value={2}>
          <SavedView />
        </Tab>

        <Tab title="下载" systemImage="arrow.down.circle.fill" value={3}>
          <DownloadView />
        </Tab>

        <Tab title="设置" systemImage="gear" value={4}>
          <SettingView />
        </Tab>
      </TabView>
    </NavigationStack>
  )
}
