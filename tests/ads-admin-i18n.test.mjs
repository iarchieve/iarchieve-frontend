import test from "node:test";
import assert from "node:assert/strict";
import {
  languages, messages, resolveLocale, localeDirection, t
} from "../public/ads/admin-i18n.mjs";

test("supports twelve languages", () => {
  assert.equal(languages.length, 12);
  assert.equal(Object.keys(messages).length, 12);
});

test("all translations contain matching nonempty keys", () => {
  const reference = Object.keys(messages.en).sort();

  for (const [locale] of languages) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), reference);
    for (const value of Object.values(messages[locale])) {
      assert.equal(typeof value, "string");
      assert.ok(value.trim().length > 0);
    }
  }
});

test("selects browser language", () => {
  assert.equal(resolveLocale(["ko-KR"]), "ko");
  assert.equal(resolveLocale(["ja-JP"]), "ja");
  assert.equal(resolveLocale(["zh-Hant-TW"]), "zh-TW");
  assert.equal(resolveLocale(["zh-Hans-CN"]), "zh-CN");
  assert.equal(resolveLocale(["pt-BR"]), "pt");
  assert.equal(resolveLocale(["ar-SA"]), "ar");
  assert.equal(resolveLocale(["xx-YY", "es-ES"]), "es");
  assert.equal(resolveLocale(["xx-YY"]), "en");
});

test("Arabic uses RTL and all other languages use LTR", () => {
  assert.equal(localeDirection("ar"), "rtl");
  for (const [locale] of languages) {
    if (locale !== "ar") assert.equal(localeDirection(locale), "ltr");
  }
});

test("unknown translation keys cannot silently fall back", () => {
  assert.throws(() => t("en", "missing_key"));
  assert.throws(() => t("xx", "title"));
});
