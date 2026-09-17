function renderNavbar(currentPageId) {
    const pages = [
        { id: 'nav-catalog', href: 'index.html', label: 'Каталог услуг', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
        { id: 'nav-languages', href: 'languages.html', label: 'Языки', icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a19 19 0 0 1 0 18 19 19 0 0 1 0-18Z"/>' },
        { id: 'nav-categories', href: 'categories.html', label: 'Категории', icon: '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>' },
        { id: 'nav-templates', href: 'templates.html', label: 'Шаблоны', icon: '<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2M11 12h6m-6 4h4"/>' },
        { id: 'nav-products-admin', href: 'products_admin.html', label: 'Выпуск услуг', icon: '<path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9M10 12h11m-4-4 4 4-4 4"/>' }
    ];
    const currentPage = pages.find(page => page.id === currentPageId) || pages[0];
    const link = page => `<a href="${page.href}" id="${page.id}" class="nav-link${page.id === currentPageId ? ' is-active' : ''}"${page.id === currentPageId ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${page.icon}</svg><span>${page.label}</span></a>`;
    document.getElementById('navbar-placeholder').innerHTML = `
        <a class="skip-link" href="#main-content">К содержимому</a>
        <aside class="app-sidebar">
            <a href="index.html" class="brand" aria-label="Бюро переводов — каталог">
                <span class="brand-symbol" aria-hidden="true">а<span>↗</span></span>
                <span class="brand-name">Бюро<span>переводов</span></span>
            </a>
            <nav class="sidebar-nav" aria-label="Основная навигация">
                ${link(pages[0])}
                <span class="nav-caption">Управление</span>
                ${pages.slice(1).map(link).join('')}
            </nav>
            <div class="sidebar-note"><span>Ваше рабочее пространство</span><p>Данные сохраняются в этом браузере.</p></div>
        </aside>
        <header class="workspace-header"><span>Рабочее пространство <span aria-hidden="true">/</span> <strong>${currentPage.label}</strong></span><a href="${currentPageId === 'nav-catalog' ? 'products_admin.html' : 'index.html'}">${currentPageId === 'nav-catalog' ? 'Управление услугами' : 'Открыть каталог'} <span aria-hidden="true">↗</span></a></header>
    `;
    const main = document.querySelector('main');
    main.id = 'main-content';
    main.tabIndex = -1;
}
window.renderNavbar = renderNavbar;
