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

if (process.env.SMOKE_RUN_AUTH === "true") {
  const email = process.env.SMOKE_TEST_EMAIL;
  const password = process.env.SMOKE_TEST_PASSWORD;

  if (!email || !password) {
    console.error(
      "SMOKE_RUN_AUTH=true requires SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD for an existing test user."
    );
    process.exit(1);
  }

  const loginResponse = await fetch(new URL("/auth/login", apiBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": "smoke-auth-login"
    },
    body: JSON.stringify({ email, password })
  });

  if (!loginResponse.ok) {
    console.error(`auth login failed with status ${loginResponse.status}`);
    process.exit(1);
  }

  const setCookie = loginResponse.headers.get("set-cookie");
  const sessionCookie = setCookie?.split(";")[0];

  if (!sessionCookie) {
    console.error("auth login did not return a session cookie");
    process.exit(1);
  }

  const meResponse = await fetch(new URL("/auth/me", apiBaseUrl), {
    headers: {
      cookie: sessionCookie,
      "x-request-id": "smoke-auth-me"
    }
  });

  if (!meResponse.ok) {
    console.error(`/auth/me failed with status ${meResponse.status}`);
    process.exit(1);
  }

  const logoutResponse = await fetch(new URL("/auth/logout", apiBaseUrl), {
    method: "POST",
    headers: {
      cookie: sessionCookie,
      "x-request-id": "smoke-auth-logout"
    }
  });

  if (!logoutResponse.ok && logoutResponse.status !== 204) {
    console.error(`/auth/logout failed with status ${logoutResponse.status}`);
    process.exit(1);
  }

  console.log("auth smoke: ok");
}

console.log("production smoke checks passed");
