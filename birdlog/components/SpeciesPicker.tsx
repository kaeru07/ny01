"use client";

import { useMemo, useState } from "react";
import { BIRDS } from "@/lib/birds";
import { HABITAT_LABELS } from "@/lib/types";
import type { BirdSpecies } from "@/lib/types";

type Habitat = BirdSpecies["habitat"];

const HABITATS: Habitat[] = ["garden", "forest", "water", "field", "raptor"];

/**
 * 静的 JSON（BIRDS）からの種選択 UI。
 * 和名 / 英名 / 科名で検索でき、生息環境でフィルタできる。
 */
export default function SpeciesPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (speciesId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [habitat, setHabitat] = useState<Habitat | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BIRDS.filter((b) => {
      if (habitat !== "all" && b.habitat !== habitat) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q) ||
        b.family.toLowerCase().includes(q)
      );
    });
  }, [query, habitat]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="種名で検索（和名 / 英名 / 科）"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-1">
        <FilterChip
          active={habitat === "all"}
          onClick={() => setHabitat("all")}
          label="すべて"
        />
        {HABITATS.map((h) => (
          <FilterChip
            key={h}
            active={habitat === h}
            onClick={() => setHabitat(h)}
            label={HABITAT_LABELS[h]}
          />
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-200">
        {filtered.length === 0 && (
          <p className="p-3 text-sm text-stone-500">該当する種がありません</p>
        )}
        <ul className="divide-y divide-stone-100">
          {filtered.map((b) => {
            const selected = b.id === value;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onChange(b.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                    selected ? "bg-forest/10" : "hover:bg-stone-50"
                  }`}
                >
                  <span className="text-xl" aria-hidden>
                    {b.emoji}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium text-stone-800">{b.name}</span>
                    <span className="ml-2 text-xs text-stone-500">
                      {b.nameEn}
                    </span>
                    <span className="block text-[11px] text-stone-400">
                      {b.family} ・ {HABITAT_LABELS[b.habitat]}
                    </span>
                  </span>
                  {selected && (
                    <span className="text-forest" aria-label="選択中">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs ${
        active
          ? "bg-forest text-white"
          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
      }`}
    >
      {label}
    </button>
  );
}
