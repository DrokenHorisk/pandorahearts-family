// frontend/src/api/import.js
import { API_BASE } from "./index";

export async function importFamilyFiles({ family, gmbrFile, gexpFile }) {
  const fd = new FormData();
  fd.append("gmbr", gmbrFile);
  fd.append("gexp", gexpFile);

  const res = await fetch(`${API_BASE}/family/${encodeURIComponent(family)}/import`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Import failed (${res.status}): ${text || res.statusText}`);
  }

  return res.json();
}