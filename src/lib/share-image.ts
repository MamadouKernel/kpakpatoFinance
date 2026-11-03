const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
};

/** Dessine un conseil du coach sur une carte 1080 × 1350 prête à partager sur WhatsApp. */
export async function adviceToImage(advice: string): Promise<Blob | null> {
  const clean = advice.replace(/\*\*/g, "").replace(/^[-•]\s*/gm, "• ").trim().slice(0, 700);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, "#0F172A");
  bg.addColorStop(1, "#1E293B");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = "#FF7900";
  ctx.fillRect(0, 0, 1080, 14);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 54px system-ui, sans-serif";
  ctx.fillText("Kpakpato Finance", 70, 130);
  ctx.fillStyle = "#FF7900";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.fillText("Le conseil du jour", 70, 185);

  ctx.fillStyle = "#E2E8F0";
  let size = 44;
  ctx.font = `${size}px system-ui, sans-serif`;
  let lines = wrap(ctx, clean, 940);
  while (lines.length * (size + 18) > 900 && size > 26) {
    size -= 2;
    ctx.font = `${size}px system-ui, sans-serif`;
    lines = wrap(ctx, clean, 940);
  }
  lines.forEach((l, i) => ctx.fillText(l, 70, 290 + i * (size + 18)));

  ctx.fillStyle = "#94A3B8";
  ctx.font = "30px system-ui, sans-serif";
  ctx.fillText("kpakpato-finance.vercel.app", 70, 1280);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Partage l'image (feuille de partage du téléphone, donc WhatsApp) ou la télécharge si le partage de fichiers n'existe pas. */
export async function shareAdviceImage(advice: string): Promise<"shared" | "downloaded" | "failed"> {
  const blob = await adviceToImage(advice);
  if (!blob) return "failed";
  const file = new File([blob], "kpakpato-conseil.png", { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: "Mon conseil Kpakpato Finance" });
      return "shared";
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kpakpato-conseil.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
