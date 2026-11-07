export function createInvestigationRequest(scope, question) {
  const text = question.trim();
  if (!text) throw new TypeError('조사할 사건이나 질문을 입력하세요.');
  return { scope, question: text };
}
