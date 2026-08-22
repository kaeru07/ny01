import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { analyzeHand, countRemainingTile } from "../lib/mahjong/analyzer";
import {
  createQueuedHandDraftSaver,
  loadHandDraftAsync,
  MAX_HAND_INPUT_LENGTH,
} from "../lib/mahjong/handDraft";
import { parseHand } from "../lib/mahjong/parser";
import { tileToString } from "../lib/mahjong/tiles";
import type { AnalysisResult } from "../lib/mahjong/types";
import { AppErrorBoundary } from "./AppErrorBoundary";

const EXAMPLES = [
  {
    label: "13枚のサンプル",
    value: "123m456p789s11z12m",
    accessibilityHint: "選択すると、有効牌と受け入れ枚数をすぐに解析します",
  },
  {
    label: "14枚のサンプル",
    value: "123m456p789s11z12m5p",
    accessibilityHint: "選択すると、打牌候補と受け入れ枚数をすぐに解析します",
  },
] as const;
const INITIAL_CANDIDATE_COUNT = 3;

function shantenLabel(shanten: number) {
  if (shanten === -1) return "和了形";
  if (shanten === 0) return "テンパイ";
  return `${shanten}向聴`;
}

function effectiveTileSummary(
  effectiveTiles: AnalysisResult["effectiveTiles"],
  visibleTiles: AnalysisResult["hand"]
) {
  return effectiveTiles
    .map(
      (tile) =>
        `${tileToString(tile)} ${countRemainingTile(tile, visibleTiles)}枚`
    )
    .join("・");
}

function AnalyzerScreen() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [isRestoringDraft, setIsRestoringDraft] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const analysisFrameRef = useRef<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const isMountedRef = useRef(true);
  const draftSaveRef = useRef(createQueuedHandDraftSaver(AsyncStorage));
  const draftSaveRevisionRef = useRef(0);
  const inputTileCount = (input.normalize("NFKC").match(/[0-9]/g) ?? []).length;
  const hasAnalyzableTileCount = inputTileCount === 13 || inputTileCount === 14;
  const isValidHand = hasAnalyzableTileCount && parseHand(input).success;
  const inputStatus =
    inputTileCount === 0
      ? "入力枚数: 0枚（13枚または14枚を入力）"
      : isValidHand
        ? `入力枚数: ${inputTileCount}枚（解析できます）`
        : hasAnalyzableTileCount
          ? `入力枚数: ${inputTileCount}枚（入力形式を確認してください）`
          : `入力枚数: ${inputTileCount}枚（13枚または14枚にしてください）`;

  useEffect(() => {
    let active = true;
    const loadRevision = draftSaveRevisionRef.current;

    void loadHandDraftAsync(AsyncStorage).then((draft) => {
      if (active) {
        // 端末ストレージの読み込み完了前にユーザーが入力を始めた場合、
        // 遅れて返った古い下書きで現在の入力を上書きしない。
        if (draft && loadRevision === draftSaveRevisionRef.current) {
          setInput(draft);

          const parsed = parseHand(draft);
          if (parsed.success) {
            try {
              setShowAllCandidates(false);
              setResult(analyzeHand(parsed.tiles));
            } catch {
              // Effect 内の例外は ErrorBoundary では捕捉されない。旧版の保存値や
              // 将来の解析ロジック変更と整合しない場合も、未処理 Promise rejection
              // にせず、入力を残したままユーザーが再試行できる状態へ着地させる。
              setResult(null);
              setError(
                "保存した手牌を解析できませんでした。入力内容を確認してください。"
              );
            }
          }
        }
        setIsRestoringDraft(false);
      }
    });

    return () => {
      active = false;
      isMountedRef.current = false;
      if (analysisFrameRef.current !== null) {
        cancelAnimationFrame(analysisFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable は確認中に null になり得るため、明確に切断と
      // 判定できた場合だけ警告し、起動直後の誤表示を避ける。
      setIsOffline(
        state.isConnected === false || state.isInternetReachable === false
      );
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isAnalyzing || isRestoringDraft) return;

    if (error) {
      AccessibilityInfo.announceForAccessibility(`解析エラー。${error}`);
      return;
    }

    if (!result) return;

    const summary =
      result.tileCount === 13
        ? `${shantenLabel(result.shanten)}。有効牌${result.effectiveTiles.length}種、受け入れ${result.effectiveTileCount}枚です。`
        : result.shanten === -1
          ? "和了形です。手牌が完成しています。"
          : `${shantenLabel(result.shanten)}。打牌候補${result.discardCandidates.length}件、第1候補の受け入れ${result.effectiveTileCount}枚です。`;

    // iOS では accessibilityLiveRegion だけでは更新が読まれないため、
    // 解析完了を明示的に通知する。結果が入力欄の下に隠れやすい小画面では、
    // 同時に結果カードまで移動して次の操作へつなげる。
    AccessibilityInfo.announceForAccessibility(`解析が完了しました。${summary}`);
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [error, isAnalyzing, isRestoringDraft, result]);

  function analyze(value = input) {
    if (analysisFrameRef.current !== null) {
      cancelAnimationFrame(analysisFrameRef.current);
      analysisFrameRef.current = null;
    }

    const parsed = parseHand(value);
    if (!parsed.success) {
      setIsAnalyzing(false);
      setResult(null);
      setError(parsed.error);
      return;
    }

    setIsAnalyzing(true);
    setShowAllCandidates(false);
    setResult(null);
    setError(null);
    // 処理中表示を先に描画し、連打による二重実行を防いでから解析する。
    analysisFrameRef.current = requestAnimationFrame(() => {
      analysisFrameRef.current = null;
      try {
        setResult(analyzeHand(parsed.tiles));
      } catch {
        setResult(null);
        setError("解析中にエラーが発生しました。手牌を確認してください。");
      } finally {
        setIsAnalyzing(false);
      }
    });
  }

  function updateInput(value: string) {
    if (analysisFrameRef.current !== null) {
      cancelAnimationFrame(analysisFrameRef.current);
      analysisFrameRef.current = null;
    }
    setInput(value);
    setIsAnalyzing(false);
    setError(null);
    setShowAllCandidates(false);
    setResult(null);
    const saveRevision = ++draftSaveRevisionRef.current;
    void draftSaveRef.current(value).then((saved) => {
      // 古い入力の保存完了や、画面を閉じた後の非同期完了が、現在の画面へ
      // 警告表示を書き戻さない。ErrorBoundary からの再生成時にも旧画面の
      // 保存処理は端末側で完了させつつ、破棄済み state は更新しない。
      if (
        !isMountedRef.current ||
        saveRevision !== draftSaveRevisionRef.current
      ) {
        return;
      }
      setStorageWarning(value.trim().length > 0 && !saved);
    });
  }

  function clearInput() {
    updateInput("");
    setStorageWarning(false);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          contentContainerStyle={styles.container}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
        >
          <Text accessibilityRole="header" style={styles.title}>
            麻雀手牌解析
          </Text>
          <Text style={styles.subtitle}>
            13枚で有効牌、14枚で打牌候補と受け入れ枚数を解析します。
          </Text>

          {isOffline ? (
            <View accessibilityLiveRegion="polite" style={styles.offlineCard}>
              <Text style={styles.offlineText}>
                オフラインです。手牌解析はこのまま利用できます。
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>手牌</Text>
            <TextInput
              accessibilityLabel="解析する13枚または14枚の手牌"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              maxLength={MAX_HAND_INPUT_LENGTH}
              onChangeText={updateInput}
              onSubmitEditing={() => analyze()}
              placeholder="123m456p789s11z12m"
              returnKeyType="done"
              style={styles.input}
              value={input}
            />
            <Text
              accessibilityLiveRegion="polite"
              style={
                inputTileCount === 0
                  ? styles.inputStatus
                  : isValidHand
                    ? styles.inputStatusValid
                    : styles.inputStatusWarning
              }
            >
              {inputStatus}
            </Text>
            {storageWarning ? (
              <Text accessibilityLiveRegion="polite" style={styles.warningText}>
                この端末では入力を保存できません。解析は引き続き利用できます。
              </Text>
            ) : null}
            <Pressable
              accessibilityHint={
                isValidHand
                  ? "入力した手牌の有効牌と受け入れ枚数を表示します"
                  : "13枚または14枚の有効な手牌を入力すると利用できます"
              }
              accessibilityState={{ disabled: isAnalyzing || !isValidHand }}
              accessibilityRole="button"
              disabled={isAnalyzing || !isValidHand}
              onPress={() => analyze()}
              style={({ pressed }) => [
                styles.primaryButton,
                (isAnalyzing || !isValidHand) && styles.primaryButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>解析</Text>
            </Pressable>
            {input.length > 0 ? (
              <Pressable
                accessibilityLabel="入力した手牌と解析結果をクリア"
                accessibilityState={{ disabled: isAnalyzing }}
                accessibilityRole="button"
                disabled={isAnalyzing}
                onPress={clearInput}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>クリア</Text>
              </Pressable>
            ) : null}
            <View style={styles.examples}>
              {EXAMPLES.map((example) => (
                <Pressable
                  key={example.value}
                  accessibilityHint={example.accessibilityHint}
                  accessibilityLabel={example.label}
                  accessibilityState={{ disabled: isAnalyzing }}
                  accessibilityRole="button"
                  disabled={isAnalyzing}
                  onPress={() => {
                    // サンプル選択も手入力と同じ保存経路を通し、再起動後に
                    // 選択した手牌と解析結果を復元できるようにする。
                    updateInput(example.value);
                    analyze(example.value);
                  }}
                  style={({ pressed }) => [styles.exampleButton, pressed && styles.pressed]}
                >
                  <Text style={styles.exampleText}>{example.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {isRestoringDraft ? (
            <View accessibilityLiveRegion="polite" style={styles.loadingCard}>
              <Text style={styles.loadingText}>保存した手牌を確認しています…</Text>
            </View>
          ) : isAnalyzing ? (
            <View accessibilityLiveRegion="polite" style={styles.loadingCard}>
              <Text style={styles.loadingText}>手牌を解析しています…</Text>
            </View>
          ) : error ? (
            <View accessibilityLiveRegion="assertive" style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => analyze()}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryButtonText}>もう一度解析する</Text>
              </Pressable>
            </View>
          ) : result ? (
            <View accessibilityLiveRegion="polite" style={styles.card}>
              <Text accessibilityRole="header" style={styles.resultTitle}>
                解析結果
              </Text>
              <Text style={styles.resultMain}>{shantenLabel(result.shanten)}</Text>
              <Text style={styles.resultDetail}>
                {result.tileCount === 13
                  ? `有効牌 ${result.effectiveTiles.length}種・受け入れ ${result.effectiveTileCount}枚`
                  : result.shanten === -1
                    ? "手牌が完成しています"
                    : `打牌候補 ${result.discardCandidates.length}件・第1候補の受け入れ ${result.effectiveTileCount}枚`}
              </Text>
              {result.shanten >= 0 ? (
                <View style={styles.acceptanceNote}>
                  <Text style={styles.acceptanceNoteText}>
                    受け入れ枚数は、手牌で見えている牌だけを差し引いた理論上の最大枚数です。河や他家の副露で見えている牌は含みません。
                  </Text>
                </View>
              ) : null}
              {result.tileCount === 13 && result.effectiveTiles.length > 0 ? (
                <View style={styles.resultList}>
                  <Text style={styles.resultListTitle}>有効牌</Text>
                  <Text style={styles.tileList}>
                    {effectiveTileSummary(result.effectiveTiles, result.hand)}
                  </Text>
                </View>
              ) : null}
              {result.tileCount === 13 && result.effectiveTiles.length === 0 ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={styles.noEffectiveTilesCard}
                >
                  <Text style={styles.noEffectiveTilesTitle}>
                    有効牌が見つかりませんでした
                  </Text>
                  <Text style={styles.noEffectiveTilesText}>
                    シャンテン数を下げる牌がないため、入力内容を確認してください。
                  </Text>
                </View>
              ) : null}
              {result.tileCount === 14 && result.discardCandidates.length > 0 ? (
                <View style={styles.resultList}>
                  <Text style={styles.resultListTitle}>おすすめの打牌</Text>
                  {result.discardCandidates
                    .slice(
                      0,
                      showAllCandidates
                        ? result.discardCandidates.length
                        : INITIAL_CANDIDATE_COUNT
                    )
                    .map((candidate, index) => (
                      <View
                        key={`${candidate.tile.number}${candidate.tile.suit}`}
                        style={styles.candidate}
                      >
                        <Text style={styles.candidateTitle}>
                          {index + 1}. {tileToString(candidate.tile)}を切る — {shantenLabel(candidate.resultShanten)}
                        </Text>
                        <Text style={styles.candidateDetail}>
                          有効牌 {effectiveTileSummary(candidate.effectiveTiles, result.hand) || "なし"}
                          {`（受け入れ ${candidate.effectiveTileCount}枚）`}
                        </Text>
                        <Text style={styles.candidateReason}>{candidate.reason}</Text>
                      </View>
                    ))}
                  {result.discardCandidates.length > INITIAL_CANDIDATE_COUNT ? (
                    <Pressable
                      accessibilityLabel={
                        showAllCandidates
                          ? "打牌候補を上位3件に折りたたむ"
                          : `残り${result.discardCandidates.length - INITIAL_CANDIDATE_COUNT}件の打牌候補を展開する`
                      }
                      accessibilityRole="button"
                      accessibilityState={{ expanded: showAllCandidates }}
                      onPress={() => setShowAllCandidates((current) => !current)}
                      style={({ pressed }) => [styles.expandButton, pressed && styles.pressed]}
                    >
                      <Text style={styles.expandButtonText}>
                        {showAllCandidates
                          ? "上位3件だけ表示"
                          : `残り${result.discardCandidates.length - INITIAL_CANDIDATE_COUNT}件を表示`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>解析結果はここに表示されます</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AnalyzerScreen />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: {
    alignSelf: "center",
    gap: 16,
    maxWidth: 720,
    padding: 20,
    width: "100%",
  },
  title: { color: "#1f2937", fontSize: 26, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#64748b", lineHeight: 21, textAlign: "center" },
  card: { backgroundColor: "#fff", borderColor: "#e2e8f0", borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 },
  label: { color: "#334155", fontSize: 15, fontWeight: "600" },
  input: { borderColor: "#cbd5e1", borderRadius: 10, borderWidth: 1, fontSize: 17, minHeight: 48, paddingHorizontal: 12 },
  inputStatus: { color: "#64748b", fontSize: 13, lineHeight: 19 },
  inputStatusValid: { color: "#15803d", fontSize: 13, fontWeight: "600", lineHeight: 19 },
  inputStatusWarning: { color: "#a16207", fontSize: 13, fontWeight: "600", lineHeight: 19 },
  primaryButton: { alignItems: "center", backgroundColor: "#2563eb", borderRadius: 10, justifyContent: "center", minHeight: 48 },
  primaryButtonDisabled: { backgroundColor: "#94a3b8" },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryButton: { alignItems: "center", borderColor: "#cbd5e1", borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 44 },
  secondaryButtonText: { color: "#475569", fontSize: 15, fontWeight: "600" },
  pressed: { opacity: 0.72 },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  exampleButton: { alignItems: "center", borderColor: "#cbd5e1", borderRadius: 10, borderWidth: 1, flexBasis: 180, flexGrow: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  exampleText: { color: "#2563eb", fontWeight: "600", textAlign: "center" },
  errorCard: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderRadius: 12, borderWidth: 1, padding: 16 },
  errorText: { color: "#b91c1c", lineHeight: 21 },
  retryButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: "#fff", borderColor: "#fca5a5", borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 16 },
  retryButtonText: { color: "#b91c1c", fontWeight: "700" },
  warningText: { color: "#92400e", fontSize: 13, lineHeight: 19 },
  offlineCard: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderRadius: 12, borderWidth: 1, padding: 14 },
  offlineText: { color: "#92400e", fontSize: 14, lineHeight: 20 },
  loadingCard: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe", borderRadius: 12, borderWidth: 1, padding: 16 },
  loadingText: { color: "#1d4ed8", lineHeight: 21 },
  resultTitle: { color: "#475569", fontSize: 15, fontWeight: "600" },
  resultMain: { color: "#2563eb", fontSize: 28, fontWeight: "700" },
  resultDetail: { color: "#334155", lineHeight: 22 },
  acceptanceNote: { backgroundColor: "#f0f9ff", borderColor: "#bae6fd", borderRadius: 10, borderWidth: 1, padding: 12 },
  acceptanceNoteText: { color: "#0c4a6e", fontSize: 13, lineHeight: 19 },
  resultList: { borderTopColor: "#e2e8f0", borderTopWidth: 1, gap: 10, paddingTop: 12 },
  resultListTitle: { color: "#334155", fontSize: 15, fontWeight: "700" },
  noEffectiveTilesCard: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderRadius: 10, borderWidth: 1, gap: 4, padding: 12 },
  noEffectiveTilesTitle: { color: "#92400e", fontSize: 15, fontWeight: "700" },
  noEffectiveTilesText: { color: "#92400e", fontSize: 13, lineHeight: 19 },
  tileList: { color: "#1d4ed8", fontSize: 17, fontWeight: "600", lineHeight: 25 },
  candidate: { backgroundColor: "#f8fafc", borderRadius: 10, gap: 4, padding: 12 },
  candidateTitle: { color: "#1e3a8a", fontSize: 16, fontWeight: "700" },
  candidateDetail: { color: "#334155", lineHeight: 21 },
  candidateReason: { color: "#64748b", fontSize: 13, lineHeight: 19 },
  expandButton: { alignItems: "center", borderColor: "#bfdbfe", borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 12 },
  expandButtonText: { color: "#1d4ed8", fontSize: 14, fontWeight: "700" },
  emptyCard: { alignItems: "center", borderColor: "#cbd5e1", borderRadius: 12, borderStyle: "dashed", borderWidth: 1, padding: 24 },
  emptyText: { color: "#64748b" },
});
