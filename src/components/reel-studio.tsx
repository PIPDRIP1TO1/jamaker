"use client";

import { useEffect, useRef, useState } from "react";

export function ReelStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const coverRef = useRef<HTMLCanvasElement>(null);
  const objectUrl = useRef("");
  const [videoName, setVideoName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("A story worth watching");
  const [part, setPart] = useState("PART 01");
  const [brand, setBrand] = useState("JA MAKER");
  const [caption, setCaption] = useState("Watch until the end. What should happen next?\n\n#reels #story #animation");
  const [accent, setAccent] = useState("#c5f25a");
  const [coverReady, setCoverReady] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  function load(file?: File) { if (!file || !file.type.startsWith("video/")) return; if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = URL.createObjectURL(file); setVideoUrl(objectUrl.current); setVideoName(file.name); setCoverReady(false); }
  function captureCover() {
    const video = videoRef.current; const canvas = coverRef.current; if (!video || !canvas || !video.videoWidth) return;
    canvas.width = 1080; canvas.height = 1920; const ctx = canvas.getContext("2d"); if (!ctx) return;
    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight); const width = video.videoWidth * scale; const height = video.videoHeight * scale;
    ctx.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    const gradient = ctx.createLinearGradient(0, 500, 0, 1920); gradient.addColorStop(0, "rgba(7,12,9,0)"); gradient.addColorStop(.68, "rgba(7,12,9,.60)"); gradient.addColorStop(1, "rgba(7,12,9,.95)"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = accent; ctx.fillRect(76, 118, 170, 12); ctx.font = "800 34px Arial"; ctx.fillText(brand.toUpperCase(), 76, 185);
    ctx.fillStyle = accent; ctx.font = "900 40px Arial"; ctx.fillText(part.toUpperCase(), 76, 1460);
    ctx.fillStyle = "#ffffff"; ctx.font = "900 86px Arial"; drawWrapped(ctx, title, 76, 1565, 920, 94, 3); setCoverReady(true);
  }
  function downloadCover() { const canvas = coverRef.current; if (!canvas || !coverReady) return; const link = document.createElement("a"); link.download = `${videoName.replace(/\.[^.]+$/, "") || "reel"}-cover.png`; link.href = canvas.toDataURL("image/png"); link.click(); }
  function downloadText(name: string, value: string, type = "text/plain") { const url = URL.createObjectURL(new Blob([value], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportPackage() { const video = videoRef.current; const payload = { format: "jamaker-reel-package", version: 1, videoName, duration, coverFrameSeconds: video?.currentTime || 0, title, part, brand, caption, output: { aspectRatio: "9:16", width: 1080, height: 1920 }, externalPublication: false }; downloadText(`${videoName.replace(/\.[^.]+$/, "") || "reel"}-package.json`, JSON.stringify(payload, null, 2), "application/json"); }

  return <>
    <section className="reel-hero"><div><span className="pill">Vertical 9:16</span><h2>Reel Studio</h2><p>Préparez le cover, la caption et le package de validation avant publication.</p></div><label className="button editor-import">Importer une vidéo<input type="file" accept="video/*" onChange={(event) => load(event.target.files?.[0])} /></label></section>
    <section className="reel-layout"><article className="panel reel-preview"><div className="workspace-topline"><span>Vidéo source</span><small>{videoName || "Aucune vidéo"}</small></div><div className="reel-phone">{videoUrl ? <video ref={videoRef} src={videoUrl} controls onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} /> : <div className="editor-empty"><strong>Importez votre Reel</strong><span>Le fichier reste dans votre navigateur</span></div>}<div className="reel-safe safe-top">Zone sûre</div><div className="reel-safe safe-bottom">Caption / interface</div></div></article>
      <aside className="panel reel-settings"><p className="eyebrow">Identité du Reel</p><form className="project-form" onSubmit={(event) => event.preventDefault()}><label>Marque<input value={brand} maxLength={35} onChange={(event) => setBrand(event.target.value)} /></label><label>Partie<input value={part} maxLength={25} onChange={(event) => setPart(event.target.value)} /></label><label>Titre du cover<textarea rows={3} value={title} maxLength={90} onChange={(event) => setTitle(event.target.value)} /></label><label>Couleur accent<input className="reel-color" type="color" value={accent} onChange={(event) => setAccent(event.target.value)} /></label><label>Caption<textarea rows={7} value={caption} maxLength={2200} onChange={(event) => setCaption(event.target.value)} /></label></form><div className="reel-actions"><button className="button button-small" disabled={!videoUrl} type="button" onClick={captureCover}>Capturer ce frame</button><button className="button button-secondary button-small" disabled={!coverReady} type="button" onClick={downloadCover}>Cover PNG</button><button className="button button-secondary button-small" type="button" onClick={() => downloadText("reel-caption.txt", caption)}>Caption TXT</button><button className="button button-secondary button-small" disabled={!videoUrl} type="button" onClick={exportPackage}>Package JSON</button></div></aside></section>
    <section className="panel reel-cover-panel"><div className="workspace-topline"><span>Cover 1080 × 1920</span><small>{coverReady ? "Prêt à télécharger" : "Choisissez le bon moment dans la vidéo"}</small></div><div className="reel-cover-canvas"><canvas ref={coverRef} /></div></section>
  </>;
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) { const words = text.trim().split(/\s+/); const lines: string[] = []; let line = ""; for (const word of words) { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; if (lines.length === maxLines - 1) break; } else line = test; } if (line && lines.length < maxLines) lines.push(line); lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight)); }
