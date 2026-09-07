import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { summarizeRegionalDay } from "../lib/kto/history-probe";
import { runKtoProbe, validDate } from "../lib/kto/probe";
import { scrubSecret } from "../lib/kto/security";

async function main() {
  const { values } = parseArgs({ options: {
    date: { type: "string", multiple: true }, output: { type: "string" },
  } });
  const key = process.env.TOUR_API_KEY?.trim();
  if (!key || !values.output || !values.date?.length || values.date.length > 16) throw new Error("인수 누락 또는 호출 상한 초과");
  const dates = [...new Set(values.date.map(validDate))];
  if (dates.some((date) => !date || date >= new Date().toISOString().slice(0, 10))) throw new Error("과거의 유효한 날짜만 조회 가능");
  const output = resolve(values.output);
  const exists = await access(output).then(() => true, (error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  if (exists) throw new Error("이전 증거 덮어쓰기 금지");
  const observations = [];
  let stoppedForAccessOrQuota = false;
  for (const date of dates as string[]) {
    const compact = date.replaceAll("-", "");
    const { summary, items } = await runKtoProbe({
      label: `기초지자체 ${date}`, service: "DataLabService", operation: "locgoRegnVisitrDDList",
      params: { startYmd: compact, endYmd: compact, numOfRows: 1000 },
      requiredFields: ["baseYmd", "signguCode", "signguNm", "touDivCd", "touDivNm", "touNum"],
      numericFields: ["touNum"], dateField: "baseYmd",
      sourceUrl: "https://www.data.go.kr/data/15101972/openapi.do", meaning: "regional-statistic",
    }, key);
    const regions = summarizeRegionalDay(items, date, summary.status === "success" && summary.collection === "complete-response");
    observations.push({ summary, regions });
    console.log(`${date}: ${summary.status}, ${summary.sampledRows}/${summary.totalCount ?? "?"}, 사용 가능한 지역 ${regions.filter((r) => r.status === "complete-day").length}/4`);
    if (["20", "22", "23", "29", "30", "31"].includes(summary.resultCode ?? "") || [401, 403, 429].includes(summary.httpStatus ?? 0)) {
      stoppedForAccessOrQuota = true;
      break;
    }
  }
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), purpose: "candidate-historical-day-sampling",
    scope: { dates, maximumCalls: 16, maximumRowsPerCall: 1000 }, stoppedForAccessOrQuota,
    limitations: ["선택일 표본이며 연속 다년 자료 확보가 아니다.", "전국 하루 응답이 1000행을 넘으면 지역 값도 사용 불가로 표시한다.",
      "현재 조회된 통신 기반 지역 추정치이며 당시 공개본이나 축제 입장객 실측이 아니다.", "현지인·외지인·외국인을 합산하지 않는다."], observations };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, scrubSecret(JSON.stringify(report, null, 2), key) + "\n", { mode: 0o600, flag: "wx" });
  console.log(`보고서 저장: ${output} (${observations.length}회)`);
  if (stoppedForAccessOrQuota || observations.some(({ summary, regions }) => summary.status === "error"
    || (summary.status === "success" && regions.some((r) => r.status !== "complete-day")))) process.exitCode = 1;
}

main().catch(() => {
  console.error("조사를 완료하지 못했습니다. 기존 키 설정·과거 날짜(최대 16개)·새 출력 경로를 확인하세요.");
  process.exitCode = 1;
});
