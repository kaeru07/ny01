import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kaeru07.mahjongtrainer",
  appName: "麻雀実戦読みトレーナー",
  webDir: "out",
  server: {
    iosScheme: "https",
  },
};

export default config;
