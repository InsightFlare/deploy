import { describe,expect,it } from "vitest";
import { localizeApiCopy,localizeBuildStatus,localizeResourceDisposition } from "../src/client/api-copy";

describe("localized API status and review content", () => {
  it("localizes known safety statements and planned actions without rewriting unknown dynamic details",()=>{
    expect(localizeApiCopy("zh","Revalidate OAuth account and ownership")).toBe("重新验证 OAuth 账户及所有权");
    expect(localizeApiCopy("ja","Nothing is installed in this account.")).not.toContain("Nothing");
    expect(localizeApiCopy("zh","Required binding DB is missing; cannot safely update.")).toContain("DB");
    expect(localizeApiCopy("zh","Unrecognized warning")).toBe("Unrecognized warning");
  });
  it("translates stable statuses and resource disposition labels",()=>{
    expect(localizeBuildStatus("zh","permission-required")).toBe("需要授权");
    expect(localizeBuildStatus("ja","not-configured")).toBe("未設定");
    expect(localizeResourceDisposition("zh","preserve")).toBe("保留");
  });
});
