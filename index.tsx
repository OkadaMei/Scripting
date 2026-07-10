import { Navigation, Script } from "scripting"
import { hanimeDatabase } from "./class/hanime_database"
import { HomePage } from "./page/index"

async function main() {
  try {
    await hanimeDatabase.init()
    const result = await Navigation.present<"close" | undefined>({
      element: <HomePage />,
      modalPresentationStyle: "overFullScreen"
    })
    if (result === "close") {
      Script.exit()
    }
  } catch (e) {
    console.present().then(Script.exit)
    console.error(e)
  }
}

main()
