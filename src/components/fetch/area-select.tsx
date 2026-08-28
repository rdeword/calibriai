"use client";

import { useMemo, useState } from "react";
import type { HhAreaOption } from "@/lib/hh/client";

export function AreaSelect({
  areas,
  value,
}: {
  areas: HhAreaOption[];
  value?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(value ?? "");

  const selectedArea = areas.find((area) => area.id === selected);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? areas.filter((area) => area.label.toLowerCase().includes(needle) || area.name.toLowerCase().includes(needle))
      : areas;
    return list.slice(0, 250);
  }, [areas, query]);

  return (
    <div className="label">
      Регион
      <input
        className="input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Начните вводить: Москва"
      />
      <select className="select" name="areaId" value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">Любой регион</option>
        {selectedArea && !filtered.some((area) => area.id === selectedArea.id) && (
          <option value={selectedArea.id}>{selectedArea.label}</option>
        )}
        {filtered.map((area) => (
          <option key={area.id} value={area.id}>
            {area.label}
          </option>
        ))}
      </select>
      <span className="muted">В запрос HH уйдёт ID региона, в списке видны названия.</span>
    </div>
  );
}
