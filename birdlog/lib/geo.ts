import type { Observation } from "./types";

/**
 * オフライン目撃マップ用のジオメトリ。
 *
 * 外部タイルサーバー（OSM 等）を一切使わず、端末内で完結する。
 * 日本の概略バウンディングボックスに equirectangular 投影し、
 * 一定間隔の「タイル」グリッドを手続き的に生成して背景にする。
 * これにより通信なし（オフライン）で地図状の可視化を成立させる。
 */

/** 日本全域の概略バウンディングボックス */
export const JP_BBOX = {
  minLat: 24,
  maxLat: 46,
  minLng: 122,
  maxLng: 154,
};

/** SVG の論理サイズ（viewBox） */
export const MAP_W = 320;
export const MAP_H = (MAP_W * (JP_BBOX.maxLat - JP_BBOX.minLat)) /
  (JP_BBOX.maxLng - JP_BBOX.minLng);

/** 1 タイルの大きさ（度）。値が小さいほどタイルが細かい。 */
export const TILE_DEG = 2;

export interface XY {
  x: number;
  y: number;
}

/** 緯度経度を SVG 座標に投影する（緯度は上が北になるよう反転）。 */
export function project(lat: number, lng: number): XY {
  const { minLat, maxLat, minLng, maxLng } = JP_BBOX;
  const x = ((lng - minLng) / (maxLng - minLng)) * MAP_W;
  const y = ((maxLat - lat) / (maxLat - minLat)) * MAP_H;
  return { x, y };
}

export interface MapTile {
  /** タイル左上の SVG 座標 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 市松模様の判定（手続き的タイル描画用） */
  even: boolean;
}

/** バウンディングボックスをタイルグリッドに分割する（オフライン手続き生成）。 */
export function buildTiles(tileDeg = TILE_DEG): MapTile[] {
  const { minLat, maxLat, minLng, maxLng } = JP_BBOX;
  const tiles: MapTile[] = [];
  let row = 0;
  for (let lat = minLat; lat < maxLat; lat += tileDeg, row++) {
    let col = 0;
    for (let lng = minLng; lng < maxLng; lng += tileDeg, col++) {
      const topLeft = project(lat + tileDeg, lng);
      const bottomRight = project(lat, lng + tileDeg);
      tiles.push({
        x: topLeft.x,
        y: topLeft.y,
        w: bottomRight.x - topLeft.x,
        h: bottomRight.y - topLeft.y,
        even: (row + col) % 2 === 0,
      });
    }
  }
  return tiles;
}

export interface MapPoint {
  key: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  count: number;
  speciesIds: string[];
}

/**
 * 座標を持つ観察記録を、粗い座標ごとに集約してマップ用の点にする。
 * 同一 0.1 度グリッドの記録は 1 点にまとめ、件数と種を保持する。
 */
export function buildPoints(records: Observation[]): MapPoint[] {
  const map = new Map<string, MapPoint>();
  for (const r of records) {
    const lat = r.location?.coarseLat;
    const lng = r.location?.coarseLng;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
    const xy = project(lat, lng);
    const cur =
      map.get(key) ??
      ({
        key,
        lat,
        lng,
        x: xy.x,
        y: xy.y,
        count: 0,
        speciesIds: [],
      } as MapPoint);
    cur.count += 1;
    if (!cur.speciesIds.includes(r.speciesId)) cur.speciesIds.push(r.speciesId);
    map.set(key, cur);
  }
  return [...map.values()];
}

/** 座標が日本の概略 bbox 内かどうか（範囲外の点はマップに出さない）。 */
export function inBounds(lat: number, lng: number): boolean {
  return (
    lat >= JP_BBOX.minLat &&
    lat <= JP_BBOX.maxLat &&
    lng >= JP_BBOX.minLng &&
    lng <= JP_BBOX.maxLng
  );
}
