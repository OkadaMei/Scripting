import { Widget } from "scripting"
import { loadBangumiWidgetData } from "./widget/loader"
import { SmallWidget } from "./widget/small"
import { MediumWidget } from "./widget/medium"
import { LargeWidget } from "./widget/large"
import type { BangumiWidgetData } from "./widget/types"

function WidgetView({ data }: { data: BangumiWidgetData }) {
  const family = Widget.family
  if (family === "systemSmall") return <SmallWidget data={data} />
  if (family === "systemLarge") return <LargeWidget data={data} />
  return <MediumWidget data={data} />
}

async function main() {
  const data = await loadBangumiWidgetData()
  Widget.present(<WidgetView data={data} />)
}

main()
