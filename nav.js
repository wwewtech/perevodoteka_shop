function renderNavbar(currentPageId) {
    const navHtml = `
        <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
            <div class="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <span class="p-1.5 bg-indigo-600 text-white rounded-lg text-sm">Engine</span>
                        Движок производства переводческих услуг
                    </h1>
                </div>
                <nav>
                    <ul class="flex flex-wrap gap-2 text-sm font-medium">
                        <li><a href="languages.html" id="nav-languages" class="block px-3 py-1.5 rounded-md transition hover:bg-slate-100 text-slate-700">Языки</a></li>
                        <li><a href="categories.html" id="nav-categories" class="block px-3 py-1.5 rounded-md transition hover:bg-slate-100 text-slate-700">Категории</a></li>
                        <li><a href="templates.html" id="nav-templates" class="block px-3 py-1.5 rounded-md transition hover:bg-slate-100 text-slate-700">Шаблоны</a></li>
                        <li><a href="products_admin.html" id="nav-products-admin" class="block px-3 py-1.5 rounded-md transition hover:bg-slate-100 text-slate-700">Выпуск товаров</a></li>
                        <li><a href="index.html" id="nav-catalog" class="block px-3 py-1.5 rounded-md transition hover:bg-emerald-50 text-emerald-700">Каталог (Витрина)</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    `;
    document.body.insertAdjacentHTML('afterbegin', navHtml);

    const activeLink = document.getElementById(currentPageId);
    if (activeLink) {
        document.querySelectorAll('nav ul li a').forEach(link => {
            link.classList.remove('bg-indigo-600', 'text-white', 'bg-emerald-600', 'text-emerald-50');
            link.classList.add('text-slate-700');
            if (link.id === 'nav-catalog') {
                link.classList.add('hover:bg-emerald-50', 'text-emerald-700');
            } else {
                link.classList.add('hover:bg-slate-100');
            }
        });

        if (currentPageId === 'nav-catalog') {
            activeLink.classList.remove('hover:bg-emerald-50');
            activeLink.classList.add('bg-emerald-600', 'text-white');
        } else {
            activeLink.classList.remove('hover:bg-slate-100');
            activeLink.classList.add('bg-indigo-600', 'text-white');
        }
    }
}
window.renderNavbar = renderNavbar;