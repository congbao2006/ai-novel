import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiRequestError } from "./api";
import { apiRequest, authRequest } from "./api";

describe("API request helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not send JSON content-type for authenticated POST requests without a body", async () => {
    const fetchMock = mockFetchJson({ ok: true });

    await authRequest("/author/stories/story-1/publish", { method: "POST" });

    const init = getFirstRequestInit(fetchMock);
    const headers = new Headers(init.headers);
    expect(init.credentials).toBe("include");
    expect(headers.has("content-type")).toBe(false);
  });

  it("does not send JSON content-type when body is explicitly null", async () => {
    const fetchMock = mockFetchJson({ ok: true });

    await authRequest("/author/stories/story-1/revisions", {
      method: "POST",
      body: null
    });

    const init = getFirstRequestInit(fetchMock);
    const headers = new Headers(init.headers);
    expect(headers.has("content-type")).toBe(false);
  });

  it("sends JSON content-type for requests with a JSON body", async () => {
    const fetchMock = mockFetchJson({ ok: true });

    await authRequest("/author/stories/story-1/factions", {
      method: "POST",
      body: JSON.stringify({
        factionKey: "hac-nguyet-hoi",
        name: "Hắc Nguyệt Hội",
        description:
          "Tổ chức quyền lực bí ẩn kiểm soát phần lớn Hắc Nguyệt Thành.",
        initialStatus: "active",
        initialInfluence: 75,
        resources: { wealth: 80, influence: 90, military: 65 },
        goals: [
          "kiem-soat-thanh-pho",
          "thu-thap-thong-tin",
          "bao-ve-bi-mat"
        ]
      })
    });

    const init = getFirstRequestInit(fetchMock);
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("preserves useful backend 400 messages for display", async () => {
    mockFetchJson(
      {
        error: "FST_ERR_CTP_EMPTY_JSON_BODY",
        message: "Body cannot be empty when content-type is set to application/json"
      },
      400
    );

    await expect(
      apiRequest("/author/stories/story-1/publish", {
        method: "POST"
      })
    ).rejects.toMatchObject({
      name: "ApiRequestError",
      statusCode: 400,
      errorCode: "FST_ERR_CTP_EMPTY_JSON_BODY",
      message: "Body cannot be empty when content-type is set to application/json"
    } satisfies Partial<ApiRequestError>);
  });

  it("keeps unexpected server errors generic when no useful message is available", async () => {
    mockFetchJson({}, 500);

    await expect(
      apiRequest("/author/stories/story-1/factions", {
        method: "POST",
        body: JSON.stringify({})
      })
    ).rejects.toMatchObject({
      name: "ApiRequestError",
      statusCode: 500,
      message: "Unexpected server error."
    } satisfies Partial<ApiRequestError>);
  });
});

function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json"
      }
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

type FetchMock = ReturnType<typeof mockFetchJson>;

function getFirstRequestInit(fetchMock: FetchMock): RequestInit {
  const init = fetchMock.mock.calls[0]?.[1];
  expect(init).toBeDefined();
  return init ?? {};
}
