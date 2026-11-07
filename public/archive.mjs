export function filterRecords(records, { query = '', topic = '', publisher = '', year = '' } = {}) {
  const words = query.normalize('NFKC').toLowerCase().trim().split(/\s+/u).filter(Boolean);
  return records.filter(record => {
    const searchable = [record.title, record.summary, record.publisher, record.type, record.topic]
      .join(' ').normalize('NFKC').toLowerCase();
    return (!topic || record.topic === topic)
      && (!publisher || record.publisher === publisher)
      && (!year || record.date?.slice(0, 4) === year)
      && words.every(word => searchable.includes(word));
  });
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

async function start() {
  const form = document.querySelector('#search');
  const reset = document.querySelector('#reset');
  const status = document.querySelector('#status');
  const results = document.querySelector('#results');
  const [query, topic, publisher, year] = ['query', 'topic', 'publisher', 'year']
    .map(id => document.getElementById(id));
  try {
    const response = await fetch(new URL('./records.json', import.meta.url));
    if (!response.ok) throw new Error('Archive unavailable');
    const records = await response.json();
    for (const [select, values] of [
      [topic, records.map(record => record.topic)],
      [publisher, records.map(record => record.publisher)],
      [year, records.flatMap(record => record.date ? [record.date.slice(0, 4)] : [])]
    ]) {
      const options = [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ko'));
      if (select === year) options.reverse();
      for (const value of options) select.add(new Option(value, value));
    }
    function render() {
      const matches = filterRecords(records, {
        query: query.value, topic: topic.value, publisher: publisher.value, year: year.value
      });
      status.textContent = matches.length ? `${matches.length}건 / 전체 ${records.length}건` : '조건에 맞는 기록이 없습니다.';
      results.replaceChildren(...matches.map(record => {
        const row = element('li', '', 'record');
        const detail = document.createElement('div');
        detail.append(element('p', `${record.topic} · ${record.publisher} · ${record.type}`, 'meta'),
          element('h3', record.title), element('p', record.summary, 'summary'));
        const link = element('a', record.linkLabel || '원문 보기', 'original');
        link.href = record.url;
        row.append(element('span', record.date || '날짜 미등록', 'date'), detail, link);
        return row;
      }));
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      render();
      document.querySelector('#records').scrollIntoView();
    });
    for (const input of [topic, publisher, year]) input.addEventListener('change', render);
    reset.addEventListener('click', () => {
      for (const input of [query, topic, publisher, year]) input.value = '';
      render();
    });
    render();
  } catch {
    status.textContent = '기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.';
  }
}
if (typeof document !== 'undefined') start();
