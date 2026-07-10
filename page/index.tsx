import { Button, Script } from "scripting"
import { BangumiHomePage } from "./bangumi"

export function HomePage() {
  const dismiss = () => {
    Script.minimize()
  }

  const closeButton = <Button title="退出" systemImage="xmark" action={dismiss} />

  return <BangumiHomePage closeButton={closeButton} />
}
