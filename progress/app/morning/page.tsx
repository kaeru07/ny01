import { redirect } from 'next/navigation'

// 朝会運用は廃止（2026-07-04）。自動実行は朝夜問わず定時で動くため、
// 「今日やること」はホーム／今日の判断で確認する。旧URLはホームへ誘導。
export default function MorningPage() {
  redirect('/')
}
