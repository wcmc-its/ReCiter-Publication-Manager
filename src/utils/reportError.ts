export function reportError(code: string, message: string, context?: any) {
  try {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, message, context: context?.message || String(context || "") }),
    }).catch(() => {}); // fire-and-forget
  } catch {}
}
