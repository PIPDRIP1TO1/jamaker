"use client";

import { useEffect, useRef, useState } from "react";

const formats = { portrait: { width: 1080, height: 1350, label: "Instagram 4:5" }, square: { width: 1080, height: 1080, label: "Carré 1:1" }, story: { width: 1080, height: 1920, label: "Story 9:16" } } as const;
type FormatKey = keyof typeof formats;

export function MiniCanvasStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageUrl = useRef<string>("");
  const [format, setFormat] = useState<FormatKey>("portrait");
  const [title, setTitle] = useState("Create something remarkable");
  const [subtitle, setSubtitle] = useState("A clean social visual made with JA MAKER");
  const [brand, setBrand] = useState("JA MAKER");
  const [background, setBackground] = useState("#183023");
  const [accent, setAccent] = useState("#c5f25a");
  const [textColor, setTextColor] = useState("#ffffff");

  useEffect(() => () => { if (imageUrl.current) URL.revokeObjectURL(imageUrl.current); }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { width, height } = formats[format]; canvas.width = width; canvas.height = height;
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    if (imageRef.current) {
      const image = imageRef.current; const scale = Math.max(width / image.width, height / image.height); const drawWidth = image.width * scale; const drawHeight = image.height * scale;
      ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
      const gradient = ctx.createLinearGradient(0, height * .25, 0, height); gradient.addColorStop(0, "rgba(8,16,11,.05)"); gradient.addColorStop(.72, "rgba(8,16,11,.72)"); gradient.addColorStop(1, "rgba(8,16,11,.96)"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    } else {
      const glow = ctx.createRadialGradient(width * .8, height * .15, 20, width * .8, height * .15, width * .75); glow.addColorStop(0, accent + "88"); glow.addColorStop(1, "transparent"); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    }
    const margin = Math.round(width * .075); const bottom = height - margin;
    ctx.fillStyle = accent; ctx.font = `800 ${Math.round(width * .026)}px Inter, Arial`; ctx.fillText(brand.toUpperCase(), margin, margin + Math.round(width * .03));
    ctx.fillStyle = textColor; ctx.font = `900 ${Math.round(width * .075)}px Inter, Arial`; drawWrapped(ctx, title, margin, bottom - Math.round(height * .22), width - margin * 2, Math.round(width * .083), 3);
    ctx.fillStyle = textColor + "dd"; ctx.font = `500 ${Math.round(width * .031)}px Inter, Arial`; drawWrapped(ctx, subtitle, margin, bottom - Math.round(height * .06), width - margin * 2, Math.round(width * .043), 2);
    ctx.fillStyle = accent; ctx.fillRect(margin, bottom, Math.round(width * .18), Math.max(9, Math.round(width * .009)));
  }, [format, title, subtitle, brand, background, accent, textColor]);

  function loadImage(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    const url = URL.createObjectURL(file); imageUrl.current = url;
    const image = new Image(); image.onload = () => { imageRef.current = image; setTitle((value) => value + " "); setTimeout(() => setTitle((value) => value.trimEnd()), 0); }; image.src = url;
  }
  function removeImage() { if (imageUrl.current) URL.revokeObjectURL(imageUrl.current); imageUrl.current = ""; imageRef.current = null; setTitle((value) => value + " "); setTimeout(() => setTitle((value) => value.trimEnd()), 0); }
  function download() { const canvas = canvasRef.current; if (!canvas) return; const link = document.createElement("a"); link.download = `jamaker-${format}-${Date.now()}.png`; link.href = canvas.toDataURL("image/png", 1); link.click(); }

  return <>
    <section className="canvas-hero"><div><span className="pill">Studio local</span><h2>Mini Canvas</h2><p>Composez et exportez vos visuels sociaux sans envoyer vos images vers le serveur.</p></div><button className="button" type="button" onClick={download}>Exporter PNG</button></section>
    <section className="canvas-layout">
      <aside className="panel canvas-controls"><p className="eyebrow">Design</p><label>Format<select value={format} onChange={(event) => setFormat(event.target.value as FormatKey)}>{Object.entries(formats).map(([key, value]) => <option value={key} key={key}>{value.label} · {value.width}×{value.height}</option>)}</select></label><label>Marque<input value={brand} maxLength={40} onChange={(event) => setBrand(event.target.value)} /></label><label>Titre<textarea rows={3} value={title} maxLength={110} onChange={(event) => setTitle(event.target.value)} /></label><label>Sous-titre<textarea rows={3} value={subtitle} maxLength={150} onChange={(event) => setSubtitle(event.target.value)} /></label><div className="canvas-colors"><label>Fond<input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label><label>Accent<input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} /></label><label>Texte<input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} /></label></div><label className="canvas-upload">Image de fond<input type="file" accept="image/*" onChange={(event) => loadImage(event.target.files?.[0])} /></label><button className="button button-secondary button-small" type="button" onClick={removeImage}>Retirer l’image</button></aside>
      <article className="panel canvas-preview"><div className="workspace-topline"><span>Prévisualisation</span><small>{formats[format].width} × {formats[format].height}</small></div><div className={`canvas-frame frame-${format}`}><canvas ref={canvasRef} /></div></article>
    </section>
  </>;
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.trim().split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; if (lines.length === maxLines - 1) break; } else line = test; }
  if (line && lines.length < maxLines) lines.push(line); lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}
