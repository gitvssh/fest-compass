export const analyticsEventDictionary = [
  {
    name: "festival_list_view",
    trigger: "축제 목록 화면 열람",
    allowedProperties: ["app_mode"],
  },
  {
    name: "festival_workspace_view",
    trigger: "근거·시나리오·원장·보고서 탭 열람",
    allowedProperties: ["tab", "app_mode"],
  },
  {
    name: "privacy_view",
    trigger: "개인정보·분석 안내 열람",
    allowedProperties: ["app_mode"],
  },
] as const;

export const analyticsConsentBoundary = {
  owner: "Cloudflare CMP",
  rule: "선택 분석은 CMP 동의 전에는 실행하지 않으며, 거부·철회 상태에서도 실행하지 않는다.",
  forbiddenProperties: [
    "festival_id",
    "festival_name",
    "author",
    "approver",
    "actor",
    "service_key",
    "free_text",
  ],
  appEmbedsVendorMeasurementId: false,
  appDefinesCmpPurposeId: false,
} as const;
