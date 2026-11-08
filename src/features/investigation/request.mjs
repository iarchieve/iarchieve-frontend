import { normalizeFields } from '../fields/catalog.mjs';

export function createInvestigationRequest(scope, question, fields) {
  const text = question.trim();
  if (!text) throw new TypeError('조사할 사건이나 질문을 입력하세요.');
  const request = { scope, question: text };
  // An explicit empty selection searches across all fields.
  if (fields !== undefined) request.fields = normalizeFields(fields);
  return request;
}
