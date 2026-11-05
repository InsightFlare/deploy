import { describe, expect, it } from "vitest";
import server from "../src/index";
import type { Env } from "../src/types";

describe("localized SPA routing", () => {
  const seen:string[]=[];
  const env={ASSETS:{
    async fetch(request:Request) {
      seen.push(new URL(request.url).pathname);
      return new Response("<html lang=\"en\">Deploy SPA</html>",{status:200,headers:{"content-type":"text/html"}});
    }
  }} as unknown as Env;
  const ctx={} as ExecutionContext;
  it("redirects the root to the preferred locale while preserving OAuth callbacks query", async ()=>{
    const response=await server.fetch(new Request("https://deploy.insightflare.net/?connected=1",{
      headers:{"accept-language":"zh-CN,zh;q=0.9"}
    }),env,ctx);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://deploy.insightflare.net/zh?connected=1");
    expect(response.headers.get("set-cookie")).toContain("if_locale=zh;");
  });
  it("serves the same SPA at every supported locale path and persists the locale",async()=>{
    seen.length=0;
    for(const locale of ["en","zh","zh-tw","ja"]){
      const response=await server.fetch(new Request("https://deploy.insightflare.net/"+locale),env,ctx);
      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain("if_locale="+locale+";");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toContain(`<html lang="${locale==="zh"?"zh-CN":locale==="zh-tw"?"zh-TW":locale}">`);
    }
    expect(seen).toEqual(["/","/","/","/"]);
  });
  it("does not intercept arbitrary routes or allow writes to a locale page",async()=>{
    const bad=await server.fetch(new Request("https://deploy.insightflare.net/ja",{method:"POST"}),env,ctx);
    expect(bad.status).toBe(405);
    const direct=await server.fetch(new Request("https://deploy.insightflare.net/favicon.svg"),env,ctx);
    expect(direct.status).toBe(200);
  });
});
