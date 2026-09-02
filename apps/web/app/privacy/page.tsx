import type { Metadata } from "next";
import { AnalyticsView } from "@/components/AnalyticsView";
import { ConsentPreference } from "@/components/ConsentPreference";
import { analyticsConsentBoundary, analyticsEventDictionary } from "@/lib/analytics-events";
import { isPublicReadonly } from "@/lib/app-mode";
import { canonicalUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "개인정보·분석 안내",
  description: `${siteConfig.name}의 저장 정보와 선택 분석 동의 경계를 안내합니다.`,
  alternates: { canonical: canonicalUrl("/privacy") },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 rounded-3xl bg-white p-6 shadow-card md:p-9">
      <AnalyticsView
        event="privacy_view"
        properties={{ app_mode: isPublicReadonly() ? "public-readonly" : "editor" }}
      />
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue">Privacy & analytics</p>
        <h1 className="mt-2 text-3xl font-extrabold">개인정보·분석 안내</h1>
        <p className="mt-3 text-sm text-muted">
          {siteConfig.name}은 축제 운영 근거를 기록하는 서비스입니다. 공개 읽기 전용 화면은 데이터를 변경하지 않습니다.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-extrabold">서비스에 저장되는 정보</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          편집 모드에서 입력한 축제명, 일정, 장소, 가정, 승인자·작성자·담당자 표기, 결정과 실측값은 운영 데이터베이스에 저장됩니다.
          자유 입력란에는 불필요한 개인정보를 입력하지 마세요. 공개 읽기 전용 배포에서는 이러한 입력 기능이 서버에서 차단됩니다.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-extrabold">공공데이터 호출</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          인증된 편집 모드의 KTO 새로고침은 축제 일정·지역·콘텐츠 식별자를 공공데이터포털 API에 전송할 수 있습니다.
          서비스키는 서버 Secret으로만 사용하며 화면이나 분석 이벤트 속성에 포함하지 않습니다.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-extrabold">선택 분석과 동의 경계</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          선택 분석은 <strong className="font-bold text-ink">동의하신 경우에만</strong> 실행됩니다. 선택하기 전과 거부·철회 후에는
          아무것도 전송되지 않으며, 실행 여부는 {analyticsConsentBoundary.owner}가 판단합니다. 아래에서 언제든 바꾸실 수 있습니다.
          앱에는 분석 사업자 측정 ID나 Cloudflare purpose ID를 넣지 않습니다 — 동의 여부만 전달하고, 콘솔에 실제로 어떤 목적이
          설정돼 있는지는 앱이 알지 못합니다. 보안·전송을 위한 Cloudflare의 필수 처리와 선택 분석은 별도 경계로 취급합니다.
        </p>
        <ConsentPreference />
      </section>

      <section>
        <h2 className="text-xl font-extrabold">허용 이벤트 사전</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr><th className="pb-2">이벤트</th><th className="pb-2">트리거</th><th className="pb-2">허용 속성</th></tr>
            </thead>
            <tbody>
              {analyticsEventDictionary.map((event) => (
                <tr key={event.name} className="border-t border-ink/5 align-top">
                  <td className="py-3 pr-3 font-mono text-xs">{event.name}</td>
                  <td className="py-3 pr-3">{event.trigger}</td>
                  <td className="py-3 text-muted">{event.allowedProperties.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-6 text-coral">
          금지 속성: {analyticsConsentBoundary.forbiddenProperties.join(", ")}. 자유 입력 내용과 개인·축제 식별자는 분석으로 보내지 않습니다.
        </p>
        <p className="mt-2 text-xs leading-6 text-muted">
          앱은 위 표의 이벤트만, 표에 적힌 속성만 전송합니다. 속성값은 모두 고정된 목록(탭 이름과 앱 모드)이며 축제명·식별자·주소·자유 입력은
          전송 직전에 제거됩니다. 전송은 {analyticsConsentBoundary.owner}가 동의를 확인한 뒤에만 동작하고, 거부·철회 상태에서는 아무것도
          보내지 않습니다. 앱에는 분석 사업자 측정 ID나 목적 ID가 들어 있지 않습니다.
        </p>
      </section>
    </article>
  );
}
