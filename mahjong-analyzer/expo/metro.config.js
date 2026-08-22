const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);

// Web基準実装とExpo版で牌解析ロジックを複製せず、同じ実装を利用する。
config.watchFolders = [workspaceRoot];

module.exports = config;
