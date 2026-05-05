

    const btn      = document.getElementById('catalogBtn');
    const dropdown = document.getElementById('catalogDropdown');
    const overlay  = document.getElementById('catalogOverlay');

    function toggleCatalog() {
        const isOpen = dropdown.classList.contains('open');
        isOpen ? closeCatalog() : openCatalog();
    }

    function openCatalog() {
        dropdown.classList.add('open');
        overlay.classList.add('open');
        btn.classList.add('is-open');
    }

    function closeCatalog() {
        dropdown.classList.remove('open');
        overlay.classList.remove('open');
        btn.classList.remove('is-open');
    }

    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCatalog();
    });

    const GENRE_BY_CAT = {
        romans: 1,
        fantasy: 2,
        detective: 3,
        classic: 4,
        manga: 5,
        children: 6,
        psychology: 7,
        history: 8
    };

    
    function showSubcat(id, ev) {
        document.querySelectorAll('.cat-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.catalog-subcats').forEach(el => el.classList.remove('active'));

        const current = ev?.currentTarget || null;
        if (current) current.classList.add('active');
        const panel = document.getElementById('subcat-' + id);
        if (panel) panel.classList.add('active');
    }

   
    document.querySelectorAll('.catalog-categories .cat-item').forEach(item => {
        if (item.tagName.toLowerCase() === 'a') return;
        const raw = item.getAttribute('onmouseenter') || '';
        const m = raw.match(/showSubcat\('([^']+)'\)/);
        const catId = m ? m[1] : null;
        const genreId = catId ? GENRE_BY_CAT[catId] : null;
        if (!genreId) return;
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
            window.location.href = `catalog.html?genre_id=${genreId}`;
        });
        item.addEventListener('mouseenter', e => showSubcat(catId, e));
    });

  
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            btn.classList.toggle('active');
            const heart = btn.querySelector('.heart');
            heart.textContent = btn.classList.contains('active') ? '♥' : '♡';
        });
    });
