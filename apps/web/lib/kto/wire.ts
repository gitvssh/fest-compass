export type KtoWireFormat = "json" | "xml" | "unknown";

export type KtoWirePayload = {
  format: KtoWireFormat;
  resultCode: string | null;
  resultMsg: string;
  gatewayCode: string | null;
  gatewayMessage: string;
  totalCount: number | null;
  pageNo: number | null;
  numOfRows: number | null;
  items: Record<string, unknown>[];
  structure: string[];
  contractError: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function stringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function keysOf(value: unknown, prefix = ""): string[] {
  const record = asRecord(value);
  if (!record) return [];
  return Object.keys(record).map((key) => (prefix ? `${prefix}.${key}` : key));
}

function parseJsonPayload(value: unknown): KtoWirePayload {
  const json = asRecord(value);
  if (!json) return unknownPayload("JSON 최상위가 객체가 아닙니다.");

  const gatewayRoot = asRecord(json.OpenAPI_ServiceResponse);
  const gatewayHeader = asRecord(gatewayRoot?.cmmMsgHeader);
  if (gatewayHeader) {
    return {
      format: "json",
      resultCode: null,
      resultMsg: "",
      gatewayCode: stringValue(gatewayHeader.returnReasonCode) || null,
      gatewayMessage:
        stringValue(gatewayHeader.returnAuthMsg) || stringValue(gatewayHeader.errMsg) || "게이트웨이 오류",
      totalCount: null,
      pageNo: null,
      numOfRows: null,
      items: [],
      structure: ["OpenAPI_ServiceResponse", ...keysOf(gatewayHeader, "OpenAPI_ServiceResponse.cmmMsgHeader")],
      contractError: null,
    };
  }

  // KTO services use both { response: { header, body } } and
  // { header, body }. Accept only those two explicit envelopes.
  const responseRoot = asRecord(json.response) ?? json;
  const header = asRecord(responseRoot.header);
  const body = asRecord(responseRoot.body);
  if (!header && !body && json.resultCode !== undefined) {
    const resultCode = stringValue(json.resultCode) || null;
    const success = resultCode === "0000" || resultCode === "00";
    return {
      format: "json",
      resultCode,
      resultMsg: stringValue(json.resultMsg),
      gatewayCode: null,
      gatewayMessage: "",
      totalCount: null,
      pageNo: null,
      numOfRows: null,
      items: [],
      structure: keysOf(json),
      contractError: success ? "성공 resultCode에 KTO header/body 봉투가 없습니다." : null,
    };
  }
  const resultCode = stringValue(header?.resultCode) || null;
  const success = resultCode === "0000" || resultCode === "00";
  const itemsRoot = asRecord(body?.items);
  const rawItemsContainer = body?.items;
  const rawItems = itemsRoot?.item;
  let itemContractError: string | null = null;
  if (
    rawItemsContainer !== null &&
    rawItemsContainer !== undefined &&
    rawItemsContainer !== "" &&
    !itemsRoot
  ) {
    itemContractError = "KTO body.items가 객체 또는 빈 값이 아닙니다.";
  }
  const itemValues = asArray(rawItems);
  const parsedItems = itemValues.map(asRecord);
  if (itemValues.length && parsedItems.some((item) => item === null)) {
    itemContractError = "KTO items.item에 객체가 아닌 값이 포함되어 있습니다.";
  }
  const items = parsedItems.filter((item): item is Record<string, unknown> => item !== null);
  const totalCount = numberValue(body?.totalCount);
  const structure = [
    ...keysOf(json),
    ...keysOf(responseRoot, json.response ? "response" : ""),
    ...keysOf(header, json.response ? "response.header" : "header"),
    ...keysOf(body, json.response ? "response.body" : "body"),
  ];

  let contractError = !header || !body || !resultCode
    ? "KTO header/body/resultCode 봉투를 확인할 수 없습니다."
    : itemContractError;
  if (!contractError && success) {
    if (totalCount === null || totalCount < 0) {
      contractError = "성공 응답의 totalCount를 확인할 수 없습니다.";
    } else if (totalCount === 0 && items.length > 0) {
      contractError = "totalCount=0인데 item이 존재합니다.";
    } else if (totalCount > 0 && items.length === 0) {
      contractError = "totalCount가 양수인데 유효한 item이 없습니다.";
    } else if (items.length > totalCount) {
      contractError = "item 수가 totalCount보다 큽니다.";
    }
  }

  return {
    format: "json",
    resultCode,
    resultMsg: stringValue(header?.resultMsg),
    gatewayCode: null,
    gatewayMessage: "",
    totalCount,
    pageNo: numberValue(body?.pageNo),
    numOfRows: numberValue(body?.numOfRows),
    items,
    structure: [...new Set(structure)],
    contractError,
  };
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_match, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, digits: string) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .trim();
}

function xmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function xmlItems(xml: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const itemPattern = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  for (const match of xml.matchAll(itemPattern)) {
    const row: Record<string, unknown> = {};
    const fieldPattern = /<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
    for (const field of match[1].matchAll(fieldPattern)) {
      row[field[1]] = decodeXml(field[2]);
    }
    if (Object.keys(row).length) results.push(row);
  }
  return results;
}

function xmlStructure(xml: string): string[] {
  return [
    ...new Set(
      [...xml.matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>/g)]
        .map((match) => match[1])
        .filter((tag) => !tag.startsWith("?")),
    ),
  ];
}

function parseXmlPayload(xml: string): KtoWirePayload {
  const gatewayCode = xmlTag(xml, "returnReasonCode") || null;
  const gatewayMessage = xmlTag(xml, "returnAuthMsg") || xmlTag(xml, "errMsg");
  if (gatewayCode || /<OpenAPI_ServiceResponse\b/i.test(xml)) {
    return {
      format: "xml",
      resultCode: null,
      resultMsg: "",
      gatewayCode,
      gatewayMessage: gatewayMessage || "게이트웨이 오류",
      totalCount: null,
      pageNo: null,
      numOfRows: null,
      items: [],
      structure: xmlStructure(xml),
      contractError: gatewayCode ? null : "게이트웨이 오류 코드가 없습니다.",
    };
  }

  const resultCode = xmlTag(xml, "resultCode") || null;
  const success = resultCode === "0000" || resultCode === "00";
  const totalCount = numberValue(xmlTag(xml, "totalCount"));
  const items = xmlItems(xml);
  const hasHeader = /<header(?:\s|>)/i.test(xml);
  const hasBody = /<body(?:\s|>)/i.test(xml);
  let contractError: string | null = resultCode ? null : "XML KTO resultCode 봉투를 확인할 수 없습니다.";
  if (!contractError && success) {
    if (!hasHeader || !hasBody) {
      contractError = "성공 XML 응답의 header/body 봉투를 확인할 수 없습니다.";
    } else if (totalCount === null || totalCount < 0) {
      contractError = "성공 XML 응답의 totalCount를 확인할 수 없습니다.";
    } else if (totalCount === 0 && items.length > 0) {
      contractError = "XML totalCount=0인데 item이 존재합니다.";
    } else if (totalCount > 0 && items.length === 0) {
      contractError = "XML totalCount가 양수인데 유효한 item이 없습니다.";
    } else if (items.length > totalCount) {
      contractError = "XML item 수가 totalCount보다 큽니다.";
    }
  }
  return {
    format: "xml",
    resultCode,
    resultMsg: xmlTag(xml, "resultMsg"),
    gatewayCode: null,
    gatewayMessage: "",
    totalCount,
    pageNo: numberValue(xmlTag(xml, "pageNo")),
    numOfRows: numberValue(xmlTag(xml, "numOfRows")),
    items,
    structure: xmlStructure(xml),
    contractError,
  };
}

function unknownPayload(error: string): KtoWirePayload {
  return {
    format: "unknown",
    resultCode: null,
    resultMsg: "",
    gatewayCode: null,
    gatewayMessage: "",
    totalCount: null,
    pageNo: null,
    numOfRows: null,
    items: [],
    structure: [],
    contractError: error,
  };
}

/** Parse only documented KTO JSON envelopes or the service's simple XML envelope. */
export function parseKtoWire(rawText: string): KtoWirePayload {
  const trimmed = rawText.trim();
  if (!trimmed) return unknownPayload("빈 응답입니다.");

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return parseJsonPayload(JSON.parse(trimmed));
    } catch {
      return unknownPayload("JSON 파싱에 실패했습니다.");
    }
  }
  if (trimmed.startsWith("<")) return parseXmlPayload(trimmed);
  return unknownPayload("알 수 없는 응답 형식입니다.");
}

export function isKtoSuccessCode(code: string | null): boolean {
  return code === "0000" || code === "00";
}
