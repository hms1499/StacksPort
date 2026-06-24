import webpush from "web-push";
import { getSub } from "../push-redis";

let configured = false;
function ensureVapid(): boolean {
  if (configured) return true;
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export async function sendPushToAddress(
  addr: string,
  payload: { title: string; body: string; url?: string },
): Promise<boolean> {
  if (!ensureVapid()) return false;
  const sub = await getSub(addr);
  if (!sub?.subscription?.endpoint) return false;
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
