import { Navigation, Script } from "scripting"
import { HomePage } from "./page/index"

async function main() {
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
}

main()