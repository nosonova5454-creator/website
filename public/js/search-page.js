(function () {
    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, m =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    function formatRub(n) {
        if (n == null || n === '') return '—';
        return Number(n).toLocaleString('ru-RU') + ' ₽';
    }

    function cardHtml(b) {
        const tag = b.tag_new
            ? '<span class="tag-new">Новинка</span>'
            : b.tag_popular
                ? '<span class="tag-popular">Популярное</span>'
                : '';
        return `
<a href="product_card.html?id=${b.id}" class="book-card">
    <div class="book-cover">
        ${tag}
        <img src="${esc(b.cover_url)}" alt="${esc(b.title)}">
    </div>
    <div class="book-info">
        <div class="book-title">${esc(b.title)}</div>
        <div class="book-author">${esc(b.author)}</div>
        <div class="price-block"><span class="price">${formatRub(b.price)}</span></div>
        <div class="btn-buy">Купить</div>
    </div>
</a>`;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const p = new URLSearchParams(location.search);
        const q = (p.get('q') || '').trim();
        const qInput = document.getElementById('search-q-input');
        const title = document.getElementById('search-title');
        const count = document.getElementById('search-count');
        const grid = document.getElementById('search-grid');

        if (qInput) qInput.value = q;
        if (!grid) return;

        if (!q) {
            if (title) title.textContent = 'Поиск';
            if (count) count.textContent = 'Введите запрос: можно искать по словам в названии и авторе.';
            grid.innerHTML = '<p style="grid-column:1/-1;color:#888">Например: «спеши любить», «шекспир», «гарри поттер».</p>';
            return;
        }

        if (title) title.textContent = `Результаты: «${esc(q)}»`;
        grid.innerHTML = '<p style="grid-column:1/-1;color:#aaa">Идет поиск…</p>';

        try {
            
            const { books, total } = await Books.getAll({ search: q, limit: 200, sort: 'new' });
            if (count) count.textContent = `Найдено: ${Number(total) || 0}`;
            if (!books || !books.length) {
                grid.innerHTML = '<p style="grid-column:1/-1;color:#888">Ничего не найдено. Попробуйте другое слово или фразу.</p>';
                return;
            }
            grid.innerHTML = books.map(cardHtml).join('');
        } catch (e) {
            grid.innerHTML = `<p style="grid-column:1/-1;color:#c62828">${esc(e.message)}</p>`;
        }
    });
})();
