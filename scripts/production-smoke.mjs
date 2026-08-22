const apiBaseUrl = process.env.API_BASE_URL;

if (!apiBaseUrl) {
  console.error("API_BASE_URL is required, for example https://api.example.com.");
  process.exit(1);
}

const checks = [
  { name: "health", path: "/health", expectedStatus: 200 },
  { name: "ready", path: "/ready", expectedStatus: 200 },
  { name: "public stories", path: "/stories", expectedStatus: 200 }
];

for (const check of checks) {
  const url = new URL(check.path, apiBaseUrl);
  const response = await fetch(url, {
    headers: {
      "x-request-id": `smoke-${check.name.replaceAll(" ", "-")}`
    }
  });

  if (response.status !== check.expectedStatus) {
    const body = await response.text();
    console.error(
      `${check.name} failed: expected ${check.expectedStatus}, got ${response.status}.`
    );
    console.error(body.slice(0, 1000));
    process.exit(1);
  }

  console.log(`${check.name}: ok`);
}

console.log("production smoke checks passed");
