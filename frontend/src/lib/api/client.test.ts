import { ApiError, api, buildQuery, errorMessage } from "./client";

describe("api client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds query strings and drops empty values", () => {
    expect(
      buildQuery({
        q: "ring",
        page: 2,
        metal_type: ["gold", "platinum"],
        featured: false,
        empty: "",
      }),
    ).toBe("?q=ring&page=2&metal_type=gold&metal_type=platinum");
  });

  it("sends the CSRF header on mutations and parses JSON", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await api.post("/auth/login", { identifier: "a", password: "b" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/auth/login");
    expect((init?.headers as Record<string, string>)["X-Requested-With"]).toBe("jewelora");
    expect(init?.credentials).toBe("same-origin");
  });

  it("maps the error envelope into ApiError with a safe message", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "validation_error",
              message: "Some of the information provided is not valid.",
              details: [{ field: "body.email", message: "Invalid" }],
            },
          }),
          { status: 422 },
        ),
    );
    await expect(api.post("/auth/register", {})).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    });
    try {
      await api.post("/auth/register", {});
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).fieldErrors).toEqual([{ field: "body.email", message: "Invalid" }]);
    }
  });

  it("never leaks technical text for network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.get("/products")).rejects.toMatchObject({ code: "network_error" });
    expect(errorMessage(new TypeError("boom"))).not.toMatch(/boom/);
  });
});
