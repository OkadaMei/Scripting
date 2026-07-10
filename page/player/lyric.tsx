import { Text, VStack } from "scripting"

export function Lyric() {
  return (
    <VStack
      spacing={6}
      padding={14}
      background={{ style: "ultraThinMaterial", shape: { type: "rect", cornerRadius: 20 } }}
    >
      <Text font="caption" foregroundStyle="rgba(255,255,255,0.56)">歌词</Text>
      <Text foregroundStyle="rgba(255,255,255,0.82)" font="subheadline">暂无歌词内容</Text>
      <Text foregroundStyle="rgba(255,255,255,0.46)" font="footnote">本地播放器当前专注于音频导入与播放体验</Text>
    </VStack>
  )
}
