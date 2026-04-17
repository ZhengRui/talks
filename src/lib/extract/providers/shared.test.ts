import { describe, expect, it, vi, beforeEach } from "vitest";

describe("installProxyDispatcherOnce", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
  });

  it("is a no-op when no proxy env is set", async () => {
    const setGlobalDispatcher = vi.fn();
    vi.doMock("undici", () => ({ setGlobalDispatcher, ProxyAgent: vi.fn() }));
    const { installProxyDispatcherOnce } = await import("./shared");
    installProxyDispatcherOnce();
    expect(setGlobalDispatcher).not.toHaveBeenCalled();
  });

  it("installs a ProxyAgent when HTTPS_PROXY is set", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7897";
    const setGlobalDispatcher = vi.fn();
    const ProxyAgent = vi.fn();
    vi.doMock("undici", () => ({ setGlobalDispatcher, ProxyAgent }));
    const { installProxyDispatcherOnce } = await import("./shared");
    installProxyDispatcherOnce();
    expect(ProxyAgent).toHaveBeenCalledWith("http://127.0.0.1:7897");
    expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — second call does not re-install", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7897";
    const setGlobalDispatcher = vi.fn();
    vi.doMock("undici", () => ({ setGlobalDispatcher, ProxyAgent: vi.fn() }));
    const { installProxyDispatcherOnce } = await import("./shared");
    installProxyDispatcherOnce();
    installProxyDispatcherOnce();
    expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
  });
});
