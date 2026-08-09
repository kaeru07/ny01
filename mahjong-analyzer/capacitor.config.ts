import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kaeru07.mahjonganalyzer",
  appName: "麻雀手牌解析",
  webDir: "out",
  server: {
    iosScheme: "https",
  },
};

export default config;
