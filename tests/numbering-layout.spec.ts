import { spawnSync } from "node:child_process";
import { test, expect } from "@playwright/test";

const PYTHON_RENDER_SCRIPT = String.raw`
import json

from scripts.book_import.numbering import (
    NumberingResolver,
    build_list_tree,
    render_list_tree,
)
from scripts.tests.test_numbering import _list_paragraphs, _package, _paragraph

item_text = "Browser aligned item"
package = _package((_paragraph(item_text, num_id="22", ilvl=0),))
paragraph = package.document.find(
    ".//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
)
level = NumberingResolver(package).resolve_paragraph(paragraph)
rendered = render_list_tree(build_list_tree(_list_paragraphs(package)))
print(json.dumps({
    "html": rendered,
    "itemText": item_text,
    "leftIndentTwips": level.left_indent_twips,
    "hangingIndentTwips": level.hanging_indent_twips,
}))
`;

type NumberingFixture = {
  html: string;
  itemText: string;
  leftIndentTwips: number;
  hangingIndentTwips: number;
};

function renderNumberingFixture(): NumberingFixture {
  const result = spawnSync("python", ["-c", PYTHON_RENDER_SCRIPT], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  if (result.status !== 0) {
    throw new Error(`Python numbering renderer failed:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout.trim()) as NumberingFixture;
}

test("tab suffix aligns item text at the source left indent", async ({
  page,
}) => {
  const fixture = renderNumberingFixture();
  // NUMBERING_XML defines numId 22 with w:left="540":
  // 540 twips * 96 CSS px / 1440 twips = 36 CSS px.
  const expectedLeftPx = 36;

  await page.setContent(`<!doctype html>
        <html>
            <head>
                <style>
                    html, body { margin: 0; padding: 0; border: 0; }
                </style>
            </head>
            <body>${fixture.html}</body>
        </html>`);

  const geometry = await page.evaluate((itemText) => {
    const item = document.querySelector("li");
    const marker = document.querySelector(".list-marker");
    if (!(item instanceof HTMLLIElement) || !(marker instanceof HTMLElement)) {
      throw new Error("Rendered numbering item or marker is missing");
    }

    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
    let itemTextNode: Text | null = null;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      if (candidate.data.includes(itemText)) {
        itemTextNode = candidate;
        break;
      }
    }
    if (itemTextNode === null) {
      throw new Error("Rendered educational item text is missing");
    }

    const textStart = itemTextNode.data.indexOf(itemText);
    const range = document.createRange();
    range.setStart(itemTextNode, textStart);
    range.setEnd(itemTextNode, textStart + itemText.length);
    const markerRange = document.createRange();
    markerRange.selectNodeContents(marker);
    const bodyStyle = getComputedStyle(document.body);

    return {
      bodyLeft: document.body.getBoundingClientRect().left,
      bodyMarginLeft: bodyStyle.marginLeft,
      bodyPaddingLeft: bodyStyle.paddingLeft,
      markerGlyphWidth: markerRange.getBoundingClientRect().width,
      textLeft: range.getBoundingClientRect().left,
    };
  }, fixture.itemText);

  expect(geometry.bodyLeft).toBe(0);
  expect(geometry.bodyMarginLeft).toBe("0px");
  expect(geometry.bodyPaddingLeft).toBe("0px");
  expect(geometry.markerGlyphWidth).toBeGreaterThan(0);
  expect(fixture.leftIndentTwips).toBe(540);
  expect(fixture.hangingIndentTwips).toBeGreaterThan(0);
  expect(geometry.textLeft).toBeCloseTo(expectedLeftPx, 1);
});
