import { Script } from "scripting"
import { hanimeClient } from "../class/hanime"

async function main() {
  const home = await hanimeClient.getHomePage()
  console.log(JSON.stringify({
    sections: home.sections.length,
    firstSection: home.sections[0]?.title,
    firstCount: home.sections[0]?.items.length || 0,
    banner: home.banner?.title || "",
  }))

  const search = await hanimeClient.searchVideos({ query: "史莱姆" })
  console.log(JSON.stringify({ searchCount: search.length, firstSearch: search[0]?.title || "" }))

  const first = home.sections.flatMap((section) => section.items)[0] || search[0]
  if (first?.videoCode) {
    const detail = await hanimeClient.getVideo(first.videoCode)
    console.log(JSON.stringify({ title: detail.title, episodes: detail.videoUrls.length, watchUrl: detail.watchUrl }))
  }
}

main()
  .catch((error) => {
    console.error(error)
    throw error
  })
  .finally(() => {
    Script.exit()
  })
