"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addObservation,
  deleteObservation,
  loadObservations,
  updateObservation,
} from "@/lib/storage";
import type { Observation, ObservationInput } from "@/lib/types";

/**
 * localStorage の観察記録を React 状態として扱うフック。
 * 読み込みは初回マウント時（クライアント）に行い、SSR では空配列。
 * `ready` で初回ロード完了を判別できる（ハイドレーション差異の回避用）。
 */
export function useObservations() {
  const [records, setRecords] = useState<Observation[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRecords(loadObservations());
    setReady(true);
  }, []);

  const create = useCallback((input: ObservationInput) => {
    setRecords(addObservation(input));
  }, []);

  const update = useCallback((id: string, input: ObservationInput) => {
    setRecords(updateObservation(id, input));
  }, []);

  const remove = useCallback((id: string) => {
    setRecords(deleteObservation(id));
  }, []);

  return { records, ready, create, update, remove };
}
