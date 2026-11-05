import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(projectRoot, "src/client/App.tsx");

describe("InsightFlare Deploy control sizing", () => {
  it("keeps action buttons and select triggers at shared UI defaults", () => {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const violations: string[] = [];
    let buttonCount = 0;
    let selectCount = 0;
    function walk(node: ts.Node): void {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        if (tag === "Button" || tag === "SelectTrigger") {
          if (tag === "Button") buttonCount++;
          else selectCount++;
          for (const attr of node.attributes.properties) {
            if (!ts.isJsxAttribute(attr)) continue;
            const attrName = attr.name.getText(source);
            if (attrName === "size" && attr.initializer?.getText(source) !== '"default"') {
              violations.push(tag + " has a non-default size at line " +
                source.getLineAndCharacterOfPosition(attr.pos).line);
            }
            if (attrName === "className" && attr.initializer &&
                /\b(?:h-[0-9]|min-h-|max-h-|text-(?:sm|lg|xl))/.test(attr.initializer.getText(source))) {
              violations.push(tag + " overrides typography or height");
            }
          }
        }
        if (tag === "Badge") {
          const className = node.attributes.properties.find(prop =>
            ts.isJsxAttribute(prop) && prop.name.getText(source) === "className");
          if (className && /\b(?:p[xy]-[0-9]|h-[0-9])/.test(className.getText(source))) {
            violations.push("Badge overrides default padding/height");
          }
        }
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
    expect(buttonCount).toBeGreaterThan(10);
    expect(selectCount).toBeGreaterThan(1);
    expect(violations).toEqual([]);
  });
});
