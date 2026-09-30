"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Clip = { id: string; name: string; url: string; duration: number; size: number };
type Adjustments = { speed: number; brightness: number; contrast: number; saturation: number };
const initialAdjustments: Adjustments = { speed: 1, brightness: 100, contrast: 100, saturation: 100 };

export function VideoEditorStudio() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [adjustments, setAdjustments] = useState<Adjustments>(initialAdjustments);
  const [draggedId, setDraggedId] = useState<string>("");
  const urls = useRef<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = clips.find((clip) => clip.id === activeId) || clips[0];
  const totalDuration = useMemo(() => clips.reduce((sum, clip) => sum + clip.duration, 0), [clips]);

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = adjustments.speed; }, [adjustments.speed, activeId]);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = Array.from(files).filter((file) => file.type.startsWith("video/")).map((file) => {
      const url = URL.createObjectURL(file); urls.current.push(url);
      return { id: crypto.randomUUID(), name: file.name, url, duration: 0, size: file.size };
    });
    setClips((current) => [...current, ...next]);
    setActiveId((current) => current || next[0]?.id || "");
  }

  function removeClip(id: string) {
    setActiveId((activeValue) => {
      if (activeValue !== id) return activeValue;
      const next = clips.find((clip) => clip.id !== id);
      return next?.id || "";
    });
    setClips((current) => {
      const removed = current.find((clip) => clip.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((clip) => clip.id !== id);
    });
  }

  function moveClip(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setClips((current) => { const from = current.findIndex((clip) => clip.id === draggedId); const to = current.findIndex((clip) => clip.id === targetId); if (from < 0 || to < 0) return current; const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
    setDraggedId("");
  }

  function exportPlan() {
    const payload = { format: "jamaker-edit-plan", version: 1, createdAt: new Date().toISOString(), magneticTimeline: true, totalDuration, adjustments, clips: clips.map(({ id, name, duration, size }) => ({ id, name, duration, size })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "jamaker-video-edit-plan.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;
  return <>
    <section className="editor-hero"><div><span className="pill">Montage local</span><h2>Video Editor</h2><p>Importez vos clips. Les fichiers restent dans votre navigateur et ne sont envoyés vers aucun serveur.</p></div><label className="button editor-import">Importer des vidéos<input type="file" accept="video/*" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /></label></section>
    <section className="editor-layout">
      <article className="editor-preview-panel panel">
        <div className="workspace-topline"><span>Prévisualisation</span><small>{active ? active.name : "Aucun clip"}</small></div>
        <div className="editor-stage">{active ? <video ref={videoRef} key={active.id} src={active.url} controls style={{ filter }} onLoadedMetadata={(event) => { const duration = event.currentTarget.duration || 0; setClips((current) => current.map((clip) => clip.id === active.id ? { ...clip, duration } : clip)); }} /> : <div className="editor-empty"><strong>Importez vos premiers clips</strong><span>MP4, WebM et formats vidéo reconnus par le navigateur</span></div>}</div>
      </article>
      <aside className="editor-properties panel"><p className="eyebrow">Propriétés</p><h2>Ajustements</h2>
        {([['speed', 'Vitesse', 0.25, 2, 0.05], ['brightness', 'Luminosité', 40, 160, 1], ['contrast', 'Contraste', 40, 160, 1], ['saturation', 'Saturation', 0, 200, 1]] as const).map(([key, label, min, max, step]) => <label className="editor-range" key={key}><span>{label}<b>{adjustments[key]}{key === "speed" ? "×" : "%"}</b></span><input type="range" min={min} max={max} step={step} value={adjustments[key]} onChange={(event) => setAdjustments((current) => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
        <div className="editor-property-actions"><button className="button button-secondary button-small" onClick={() => setAdjustments(initialAdjustments)} type="button">Réinitialiser</button><button className="button button-small" disabled={!clips.length} onClick={exportPlan} type="button">Exporter le plan</button></div>
      </aside>
    </section>
    <section className="editor-timeline panel"><div className="workspace-topline"><div><span>Timeline magnétique</span><small>Glissez les clips pour changer l’ordre · aucun espace vide</small></div><strong>{totalDuration.toFixed(1)} s</strong></div>
      <div className="timeline-track">{clips.length ? clips.map((clip, index) => <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setActiveId(clip.id); }} draggable onDragStart={() => setDraggedId(clip.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveClip(clip.id)} onClick={() => setActiveId(clip.id)} className={`timeline-clip ${active?.id === clip.id ? "is-active" : ""}`} key={clip.id}><span>{index + 1}</span><div><strong>{clip.name}</strong><small>{clip.duration ? `${clip.duration.toFixed(1)} s` : "Analyse…"}</small></div><button type="button" aria-label={`Retirer ${clip.name}`} onClick={(event) => { event.stopPropagation(); removeClip(clip.id); }}>×</button></div>) : <div className="timeline-empty">Les clips importés apparaîtront ici sans intervalle.</div>}</div>
    </section>
  </>;
}
