"use client";

import { useEffect, useRef, useState } from "react";

type ImageState = { brightness: number; contrast: number; saturation: number; grayscale: number; blur: number; zoom: number; rotation: number; flipX: boolean; flipY: boolean };
const defaults: ImageState = { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, blur: 0, zoom: 1, rotation: 0, flipX: false, flipY: false };

export function ImageCleanerStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const objectUrl = useRef("");
  const [fileName, setFileName] = useState("");
  const [state, setState] = useState<ImageState>(defaults);
  const [exportType, setExportType] = useState("image/png");
  const [quality, setQuality] = useState(92);
  const [revision, setRevision] = useState(0);

  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => {
    const canvas = canvasRef.current; const image = imageRef.current; if (!canvas || !image) return;
    const maxSide = 1600; const scaleDown = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scaleDown)); const height = Math.max(1, Math.round(image.naturalHeight * scaleDown));
    const swap = Math.abs(state.rotation % 180) === 90; canvas.width = swap ? height : width; canvas.height = swap ? width : height;
    const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(state.rotation * Math.PI / 180); ctx.scale((state.flipX ? -1 : 1) * state.zoom, (state.flipY ? -1 : 1) * state.zoom);
    ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) grayscale(${state.grayscale}%) blur(${state.blur}px)`;
    ctx.drawImage(image, -width / 2, -height / 2, width, height); ctx.restore();
  }, [state, revision]);

  function load(file?: File) {
    if (!file || !file.type.startsWith("image/")) return; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file); const image = new Image(); image.onload = () => { imageRef.current = image; setFileName(file.name); setState(defaults); setRevision((value) => value + 1); }; image.src = objectUrl.current;
  }
  function exportImage() { const canvas = canvasRef.current; if (!canvas || !imageRef.current) return; const extension = exportType === "image/png" ? "png" : "jpg"; const link = document.createElement("a"); link.download = `${fileName.replace(/\.[^.]+$/, "") || "jamaker-clean"}.${extension}`; link.href = canvas.toDataURL(exportType, quality / 100); link.click(); }
  function patch(key: keyof ImageState, value: number | boolean) { setState((current) => ({ ...current, [key]: value })); }

  return <>
    <section className="cleaner-hero"><div><span className="pill">Traitement local</span><h2>Nettoyage d’image</h2><p>Préparez une image nette et correctement cadrée avant publication.</p></div><label className="button editor-import">Choisir une image<input type="file" accept="image/*" onChange={(event) => load(event.target.files?.[0])} /></label></section>
    <section className="cleaner-layout">
      <article className="panel cleaner-preview"><div className="workspace-topline"><span>Avant export</span><small>{fileName || "Aucune image"}</small></div><div className="cleaner-stage">{fileName ? <canvas ref={canvasRef} /> : <div className="editor-empty"><strong>Ajoutez une image</strong><span>PNG, JPEG, WebP ou format reconnu par le navigateur</span></div>}</div></article>
      <aside className="panel cleaner-controls"><p className="eyebrow">Ajustements</p>{([['brightness','Luminosité',20,180,1],['contrast','Contraste',20,180,1],['saturation','Saturation',0,200,1],['grayscale','Noir et blanc',0,100,1],['blur','Adoucissement',0,5,.1],['zoom','Zoom',.5,2,.05]] as const).map(([key,label,min,max,step]) => <label className="editor-range" key={key}><span>{label}<b>{state[key]}{key === "zoom" ? "×" : key === "blur" ? "px" : "%"}</b></span><input type="range" min={min} max={max} step={step} value={state[key]} onChange={(event) => patch(key, Number(event.target.value))} /></label>)}<div className="cleaner-buttons"><button type="button" onClick={() => patch("rotation", (((state.rotation - 90) % 360) + 360) % 360)}>↶ 90°</button><button type="button" onClick={() => patch("rotation", (state.rotation + 90) % 360)}>↷ 90°</button><button type="button" className={state.flipX ? "active" : ""} onClick={() => patch("flipX", !state.flipX)}>↔ Flip</button><button type="button" className={state.flipY ? "active" : ""} onClick={() => patch("flipY", !state.flipY)}>↕ Flip</button></div><div className="cleaner-export"><label>Format<select value={exportType} onChange={(event) => setExportType(event.target.value)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label>{exportType === "image/jpeg" && <label>Qualité<input type="number" min="40" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label>}</div><div className="editor-property-actions"><button className="button button-secondary button-small" type="button" onClick={() => setState(defaults)}>Réinitialiser</button><button className="button button-small" type="button" disabled={!fileName} onClick={exportImage}>Exporter</button></div></aside>
    </section>
  </>;
}
