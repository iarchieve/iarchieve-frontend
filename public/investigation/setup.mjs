import { fieldCatalog } from './fields/catalog.mjs';
import { createScope } from './geography/scope.mjs';
import { createInvestigationRequest } from './investigation/request.mjs';

const form = document.querySelector('#investigation');
const { country, city, question, custom } = form.elements;
const selected = new Set();
const filter = document.querySelector('#field-filter');
const selection = document.querySelector('#selection');
const fields = document.querySelector('#fields');
const confirmation = document.querySelector('#confirmation');
const labels = [...new Set(Object.values(fieldCatalog).flat())].sort((a, b) => a.localeCompare(b, 'ko'));

country.addEventListener('change', () => {
  city.value = '';
  city.disabled = !country.value;
});

for (const field of labels) {
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selected.add(field);
    else selected.delete(field);
    selection.textContent = [...selected].join(' · ') || '전체 분야';
  });
  label.append(checkbox, field);
  fields.append(label);
}

filter.addEventListener('input', () => {
  const query = filter.value.normalize('NFKC').trim().toLowerCase();
  for (const label of fields.children) {
    label.hidden = !label.textContent.toLowerCase().includes(query);
  }
});

form.addEventListener('input', () => {
  confirmation.textContent = '';
  question.setCustomValidity('');
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!question.value.trim()) {
    question.setCustomValidity('조사할 사건이나 질문을 입력하세요.');
    question.reportValidity();
    return;
  }

  const customFields = custom.value.split(',').map(field => field.trim()).filter(Boolean);
  const request = createInvestigationRequest(createScope(country.value, city.value),
    question.value, [...selected, ...customFields]);
  const region = city.value ? '대한민국 · 인천광역시' : '대한민국 전체';
  confirmation.textContent = `${region} / ${request.fields.join(' · ') || '전체 분야'} / ${request.question} — 조사 범위를 확인했습니다.`;
});
