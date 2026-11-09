// 화면 흐름 점검 (AI 키 없이): MOCK_AI=1 로 서버를 띄운 뒤 실행한다.
//   MOCK_AI=1 npx next start -p 3100 &
//   node scripts/e2e.mjs http://localhost:3100 자료.pdf scripts/out [text|motion]
// 홈 → PDF 올리기 → 쪽 범위 고르기 → 개념 찾기 → 피드 → 퀴즈 순서로 넘기며 화면을 찍는다.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.argv[2] ?? "http://localhost:3100";
const pdf = process.argv[3];
const out = process.argv[4] ?? "scripts/out";
const mode = process.argv[5] ?? "text";
if (!pdf) {
  console.error("PDF 경로를 넣어 주세요: node scripts/e2e.mjs <baseUrl> <pdf> [outDir] [text|motion]");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByText("자료 올리기").first().waitFor();
  if (mode === "motion") await page.getByRole("radio", { name: /모션그래픽/ }).click();
  await shot("1-home");

  await page.setInputFiles('input[type="file"]', pdf);
  await page.getByText("이 범위로 만들기").waitFor({ timeout: 30000 });
  await shot("2-range");
  await page.getByText("이 범위로 만들기").click();

  await page.getByText("핵심 개념 찾기").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot("3-loading");

  await page.getByText("📖 해설 보기").waitFor({ timeout: 120000 });
  await page.waitForTimeout(2600);
  await shot("4-feed-card1");

  // 다음 카드들 → 퀴즈
  for (let i = 2; i <= 4; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(2200);
    await shot(`5-feed-${i}`);
  }
  const quiz = page.getByText("정답을 골라 보세요");
  if (await quiz.count()) {
    await page.locator("section button").filter({ hasText: /^[1-4]/ }).first().click().catch(() => {});
  }
  await page.waitForTimeout(800);
  await shot("6-after-answer");

  // 해설 시트
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(1200);
  const detail = page.getByText("📖 해설 보기");
  if (await detail.count()) {
    await detail.click();
    await page.waitForTimeout(600);
    await shot("7-detail");
  }
  // 보기 바꾸기 (텍스트 ↔ 모션): 같은 카드라 다시 만들지 않는다
  const close = page.getByRole("button", { name: "닫기" });
  if (await close.count()) await close.first().click({ position: { x: 20, y: 20 } });
  await page.waitForTimeout(600);
  const toggle = page.getByRole("button", { name: mode === "motion" ? "🎬 모션" : "📝 텍스트" });
  if (await toggle.count()) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(400);
    await toggle.first().click();
    await page.waitForTimeout(2600);
    await shot("8-toggled");
  } else problems.push("보기 바꾸기 버튼이 없음");
  const decks = await page.evaluate(() => JSON.parse(localStorage.getItem("studytok.decks.v1") || "[]"));
  const d = decks[0];
  console.log(
    JSON.stringify({
      saved: decks.length,
      title: d?.title,
      mode: d?.mode,
      range: d?.range,
      cards: d?.cards.map((c) => `${c.concept.term}:${c.status}${c.fallback ? "(기본)" : ""}:${c.short ? c.short.visual.type : c.scene ? "scene" : "-"}:${(c.short ?? c.scene)?.palette ?? "-"}`),
    }),
  );
} catch (e) {
  problems.push(`fail: ${e.message}`);
  await shot("error").catch(() => {});
} finally {
  await browser.close();
}
if (problems.length) {
  console.log(problems.join("\n"));
  process.exitCode = 1;
} else console.log("ok");
