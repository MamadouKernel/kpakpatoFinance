import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { parseSmsBatch } from "@/lib/sms-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 4000;

/** Compte de service Firebase (variable d'environnement FIREBASE_SERVICE_ACCOUNT : JSON brut ou encodé en base64). */
function adminDb() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  if (!getApps().length) {
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    initializeApp({ credential: cert(JSON.parse(json)) });
  }
  return getFirestore();
}

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Reçoit le texte d'un SMS ou d'une notification (envoyé par MacroDroid, Tasker, Notification Forwarder…)
 * et le dépose dans la boîte de réception de l'utilisateur : l'app l'importe à son ouverture.
 *
 * Authentification : en-tête « Authorization: Bearer <uid>.<secret> » (lien généré dans l'app).
 * Corps : { rawText: string, sourceApp?: string, timestamp?: number }
 */
export async function POST(req: NextRequest) {
  const db = adminDb();
  if (!db) return json({ error: "Serveur non configuré (FIREBASE_SERVICE_ACCOUNT manquant)." }, 503);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const dot = token.indexOf(".");
  const uid = dot > 0 ? token.slice(0, dot) : "";
  const secret = dot > 0 ? token.slice(dot + 1) : "";
  if (!uid || !secret || uid.includes("/")) return json({ error: "Jeton manquant ou invalide." }, 401);

  let body: { rawText?: unknown; sourceApp?: unknown; timestamp?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }
  const rawText = typeof body.rawText === "string" ? body.rawText.trim().slice(0, MAX_TEXT) : "";
  if (!rawText) return json({ error: "rawText est obligatoire." }, 400);

  const userRef = db.collection("users").doc(uid);
  const stored = (await userRef.get()).data()?.webhookSecret;
  if (typeof stored !== "string" || !sameSecret(stored, secret)) return json({ error: "Jeton invalide." }, 401);

  // Seuls les messages de transaction nous intéressent : les autres notifications sont ignorées.
  const { parsed } = parseSmsBatch(rawText);
  if (parsed.length === 0) return json({ status: "ignored", reason: "Aucune transaction reconnue." });

  // L'application source aide à choisir le portefeuille quand le texte ne le dit pas.
  const sourceApp = typeof body.sourceApp === "string" ? body.sourceApp.slice(0, 80) : "";
  const text = parsed.some((p) => p.walletGuessed) && sourceApp ? `${sourceApp} : ${rawText}` : rawText;

  // Identifiant stable : le même message envoyé deux fois n'est déposé qu'une fois.
  const id = createHash("sha256").update(rawText).digest("hex").slice(0, 32);
  await userRef.collection("inbox").doc(id).set({
    text,
    sourceApp,
    receivedAt: typeof body.timestamp === "number" ? body.timestamp : Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });

  return json({ status: "queued", count: parsed.length });
}

export async function GET() {
  return json({ error: "Utilisez POST." }, 405);
}
