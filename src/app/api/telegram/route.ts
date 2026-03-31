import { NextResponse } from "next/server";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const GITHUB_TOKEN = process.env.GH_PAT!;

async function sendTelegramMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

async function triggerWorkflow() {
  const res = await fetch(
    "https://api.github.com/repos/hms1499/StacksPort/actions/workflows/npm-download-ci.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );
  return res.status === 204;
}

export async function POST(request: Request) {
  const body = await request.json();
  const message = body?.message;

  if (!message?.text) return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  if (chatId !== ALLOWED_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  if (text === "/run") {
    const success = await triggerWorkflow();
    if (success) {
      await sendTelegramMessage(chatId, "CI workflow triggered successfully.");
    } else {
      await sendTelegramMessage(chatId, "Failed to trigger workflow.");
    }
  } else if (text === "/status") {
    const res = await fetch(
      "https://api.github.com/repos/hms1499/StacksPort/actions/workflows/npm-download-ci.yml/runs?per_page=1",
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    const data = await res.json();
    const run = data.workflow_runs?.[0];
    if (run) {
      await sendTelegramMessage(
        chatId,
        `*Latest run:* ${run.status} (${run.conclusion || "in progress"})\n*Started:* ${run.created_at}`
      );
    } else {
      await sendTelegramMessage(chatId, "No workflow runs found.");
    }
  } else if (text === "/downloads") {
    const res = await fetch(
      "https://api.npmjs.org/downloads/point/last-day/@stacksport/dca-sdk"
    );
    const data = await res.json();
    await sendTelegramMessage(
      chatId,
      `*@stacksport/dca-sdk*\nDownloads today: *${data.downloads}*`
    );
  }

  return NextResponse.json({ ok: true });
}
