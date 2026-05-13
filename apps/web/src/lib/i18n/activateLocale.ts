import type { SupportedLocale } from "@ccv/shared/i18n/schema";
import { i18n } from "@lingui/core";

const importMessages = async (locale: SupportedLocale) => {
  switch (locale) {
    case "ja":
      return import("./locales/ja/messages.ts");
    case "en":
      return import("./locales/en/messages.ts");
    case "zh_CN":
      return import("./locales/zh_CN/messages.ts");
    default:
      locale satisfies never;
      throw new Error(`Unsupported locale: ${String(locale)}`);
  }
};

const loadedLocales: SupportedLocale[] = [];
export const activateLocale = async (locale: SupportedLocale) => {
  if (!loadedLocales.includes(locale)) {
    const { messages } = await importMessages(locale);
    i18n.load(locale, messages);
    loadedLocales.push(locale);
  }

  i18n.activate(locale);
};
