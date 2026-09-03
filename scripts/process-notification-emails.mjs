const siteUrl = process.env.PUBLIC_SITE_URL?.trim();
const processorSecret = process.env.EMAIL_PROCESSOR_SECRET?.trim();

if (!siteUrl) {
  throw new Error("PUBLIC_SITE_URL não configurada para o processador de e-mails.");
}

if (!processorSecret) {
  throw new Error("EMAIL_PROCESSOR_SECRET não configurado para o processador de e-mails.");
}

const endpoint = new URL("/api/internal/notifications/process", siteUrl);
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${processorSecret}`,
    accept: "application/json",
  },
  signal: AbortSignal.timeout(30_000),
});

const body = await response.text();
if (!response.ok) {
  throw new Error(
    `Processador de e-mails retornou HTTP ${response.status}: ${body.slice(0, 500)}`,
  );
}

console.log(body);
