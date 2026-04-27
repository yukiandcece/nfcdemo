export const NFC_JSON_MEDIA_TYPE = "application/json";

export function isWebNfcSupported() {
  return "NDEFReader" in window;
}

export function detectNfcBrowser() {
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isChrome = /Chrome\/\d+/i.test(ua);
  const blockedShells = [
    [/EdgA\//i, "Edge Android"],
    [/SamsungBrowser\//i, "Samsung Internet"],
    [/HuaweiBrowser\//i, "Huawei Browser"],
    [/MiuiBrowser\//i, "MIUI Browser"],
    [/XiaoMi\/MiuiBrowser/i, "MIUI Browser"],
    [/MQQBrowser\//i, "QQ Browser"],
    [/QQBrowser\//i, "QQ Browser"],
    [/UCBrowser\//i, "UC Browser"],
    [/OPR\//i, "Opera"],
    [/VivoBrowser\//i, "Vivo Browser"],
    [/HeyTapBrowser\//i, "OPPO Browser"],
    [/MicroMessenger\//i, "WeChat WebView"],
    [/wv\)/i, "Android WebView"],
  ];

  const shell = blockedShells.find(([pattern]) => pattern.test(ua));
  const label = shell
    ? shell[1]
    : isAndroid && isChrome
      ? "Android Chrome"
      : isAndroid
        ? "Android 浏览器"
        : "非 Android 浏览器";

  return {
    label,
    isAndroid,
    isChrome,
    isRecommended: isAndroid && isChrome && !shell,
    userAgent: ua,
  };
}

export async function getNfcPermissionState() {
  if (!("permissions" in navigator) || !navigator.permissions.query) {
    return "unknown";
  }

  try {
    const result = await navigator.permissions.query({ name: "nfc" });
    return result.state;
  } catch {
    return "unknown";
  }
}

export async function collectNfcDiagnostics(extra = {}) {
  const browser = detectNfcBrowser();
  const permission = await getNfcPermissionState();

  return {
    browser: browser.label,
    recommendedBrowser: browser.isRecommended,
    userAgent: browser.userAgent,
    nfcApiSupported: isWebNfcSupported(),
    permission,
    secureContext: window.isSecureContext,
    topLevel: window.top === window,
    visibility: document.visibilityState,
    origin: window.location.origin,
    href: window.location.href,
    ...extra,
  };
}

export function bytesToHex(dataView) {
  if (!dataView) {
    return "";
  }

  const bytes = new Uint8Array(
    dataView.buffer,
    dataView.byteOffset,
    dataView.byteLength,
  );

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

export function readDataViewAsText(dataView, encoding = "utf-8") {
  const candidates = [encoding, "utf-8", "utf-16le"];

  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate).decode(dataView);
    } catch {
      // Try the next decoder.
    }
  }

  return "[无法直接解码为文本]";
}

export function parseNdefRecord(record) {
  const base = {
    recordType: record.recordType,
    mediaType: record.mediaType || "",
    id: record.id || "",
    byteLength: record.data?.byteLength || 0,
    rawHex: record.data ? bytesToHex(record.data) : "",
  };

  if (!record.data) {
    return base;
  }

  if (record.mediaType === NFC_JSON_MEDIA_TYPE) {
    const jsonText = readDataViewAsText(record.data);

    try {
      return {
        ...base,
        ...JSON.parse(jsonText),
      };
    } catch {
      return {
        ...base,
        rawJson: jsonText,
      };
    }
  }

  if (record.recordType === "text") {
    return {
      ...base,
      text: readDataViewAsText(record.data, record.encoding || "utf-8"),
      encoding: record.encoding || "",
      lang: record.lang || "",
    };
  }

  if (record.recordType === "url" || record.recordType === "absolute-url") {
    return {
      ...base,
      url: readDataViewAsText(record.data),
    };
  }

  if (record.mediaType) {
    return {
      ...base,
      text: readDataViewAsText(record.data),
    };
  }

  return {
    ...base,
    rawText: readDataViewAsText(record.data),
  };
}

export function parseNdefMessage(message) {
  return Array.from(message.records, parseNdefRecord);
}

export function buildNfcPreflightHints(diagnostics) {
  const hints = [];

  if (!diagnostics.nfcApiSupported) {
    hints.push("当前浏览器没有暴露 Web NFC API");
  }

  if (!diagnostics.recommendedBrowser) {
    hints.push("当前看起来不是 Android Chrome");
  }

  if (!diagnostics.secureContext) {
    hints.push("当前页面不是安全上下文");
  }

  if (!diagnostics.topLevel) {
    hints.push("当前页面不是顶层页面");
  }

  if (diagnostics.visibility !== "visible") {
    hints.push("当前页面不在前台");
  }

  if (diagnostics.permission === "denied") {
    hints.push("站点 NFC 权限当前是已拒绝");
  }

  return hints;
}

export function explainNfcScanError(error, diagnostics) {
  const hints = buildNfcPreflightHints(diagnostics);

  if (error?.name === "NotAllowedError") {
    if (hints.length > 0) {
      return `浏览器拒绝启动 NFC 扫描：${hints.join("；")}。最常见原因是没有用 Android Chrome，或者这个站点的 NFC 权限之前被拒绝了。`;
    }

    return "浏览器拒绝启动 NFC 扫描。请确认你是在 Android Chrome 中直接打开页面，站点权限里允许 NFC，且手机系统 NFC 已开启。";
  }

  if (error?.name === "NotSupportedError") {
    return "当前设备或浏览器不支持 NFC，或者系统里的 NFC 没有开启。";
  }

  if (error?.name === "InvalidStateError") {
    return "已有 NFC 扫描流程正在进行。请先停止扫描，再重新开始。";
  }

  if (error?.name === "AbortError") {
    return "扫描已停止。";
  }

  return `启动扫描失败：${error?.name || "UnknownError"} ${error?.message || ""}`.trim();
}

export function explainNfcWriteError(error, diagnostics) {
  const hints = buildNfcPreflightHints(diagnostics);

  if (error?.name === "NotAllowedError") {
    if (hints.length > 0) {
      return `浏览器拒绝写入 NFC：${hints.join("；")}。请确认使用 Android Chrome，并允许站点 NFC 权限。`;
    }

    return "浏览器拒绝写入 NFC。请确认站点 NFC 权限已允许，页面保持在前台，且手机系统 NFC 已开启。";
  }

  if (error?.name === "NotSupportedError") {
    return "当前设备或浏览器不支持 NFC 写入，或者系统里的 NFC 没有开启。";
  }

  if (error?.name === "NetworkError") {
    return "写入失败。请确认卡片是可写的 NDEF 标签，并在提示后贴近手机背面停留 1 到 2 秒。";
  }

  return `写入失败：${error?.name || "UnknownError"} ${error?.message || ""}`.trim();
}

export function createNfcScanner({ onReading, onReadingError } = {}) {
  let ndef = null;
  let controller = null;

  const cleanup = () => {
    if (ndef) {
      ndef.onreading = null;
      ndef.onreadingerror = null;
    }

    ndef = null;
    controller = null;
  };

  return {
    async start() {
      if (!isWebNfcSupported()) {
        throw new Error("Web NFC is not supported in this browser.");
      }

      ndef = new NDEFReader();
      controller = new AbortController();

      ndef.onreading = (event) => {
        onReading?.({
          event,
          serialNumber: event.serialNumber || "",
          records: parseNdefMessage(event.message),
        });
      };

      ndef.onreadingerror = (event) => {
        onReadingError?.(event);
      };

      try {
        await ndef.scan({ signal: controller.signal });
      } catch (error) {
        cleanup();
        throw error;
      }
    },

    stop() {
      try {
        controller?.abort();
      } catch {
        // Ignore abort failures.
      }

      cleanup();
    },
  };
}

export async function writeNfcJson(payload) {
  if (!isWebNfcSupported()) {
    throw new Error("Web NFC is not supported in this browser.");
  }

  const ndef = new NDEFReader();

  await ndef.write({
    records: [
      {
        recordType: "mime",
        mediaType: NFC_JSON_MEDIA_TYPE,
        data: JSON.stringify(payload),
      },
    ],
  });
}

export function writeNfcId(nfcId) {
  return writeNfcJson({ nfc_id: String(nfcId) });
}
