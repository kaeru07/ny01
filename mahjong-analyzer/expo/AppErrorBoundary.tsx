import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  recoveryKey: number;
}

/** 画面描画に失敗しても、アプリ全体が白画面のままにならないようにする。 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, recoveryKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error("Unexpected app render error", error, info.componentStack);
    }
  }

  private retry = () => {
    this.setState(({ recoveryKey }) => ({
      hasError: false,
      recoveryKey: recoveryKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <View accessibilityLiveRegion="assertive" style={styles.container}>
            <Text accessibilityRole="header" style={styles.title}>
              アプリを表示できませんでした
            </Text>
            <Text style={styles.message}>
              一時的な問題が発生しました。入力内容は端末の外部へ送信されていません。
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={this.retry}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={styles.buttonText}>もう一度試す</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return <View key={this.state.recoveryKey} style={styles.flex}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#1f2937",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: "#475569",
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 420,
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    justifyContent: "center",
    marginTop: 20,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.72 },
});
