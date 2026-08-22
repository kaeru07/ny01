import type { MetadataRoute } from "next";

/**
 * Web 版をホーム画面へ追加したときも、通常のブラウザタブではなく
 * アプリとして起動できるようにする。アイコンはストア用素材の確定後に追加する。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "麻雀手牌解析",
    short_name: "手牌解析",
    description: "手牌を入力してシャンテン数・有効牌・受け入れ枚数を解析します",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#f9fafb",
    lang: "ja",
    orientation: "any",
    categories: ["games", "utilities"],
  };
}
