// store.js
// Абсолютно пустая база данных для работы с чистого листа с поддержкой безопасности

const STORAGE_KEYS = {
    CATEGORIES: 'categories',
    TEMPLATES: 'templates',
    PRODUCTS: 'products', // Поддерживается для совместимости
    LANGUAGES: 'languages'
};

let categories = [];
let templates = [];
let products = [];
let languages = [];

// Чтение строго пустых массивов по умолчанию, без дефолтных данных
function initStore() {
    categories = JSON.parse(localStorage.getItem(STORAGE_KEYS.CATEGORIES) || '[]');
    templates = JSON.parse(localStorage.getItem(STORAGE_KEYS.TEMPLATES) || '[]');
    languages = JSON.parse(localStorage.getItem(STORAGE_KEYS.LANGUAGES) || '[]');
    syncProductsFromCategories();
}

// Синхронизация: извлекаем товары напрямую из структуры конечных подкатегорий
function syncProductsFromCategories() {
    products = categories.filter(c => c.isProduct).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        categoryId: c.id,
        categoryPathIds: getCategoryPathIds(c.id),
        templateId: c.templateId || null,
        sourceLang: c.sourceLang || '',
        targetLang: c.targetLang || '',
        basePrice: c.basePrice || 0,
        components: c.components || []
    }));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

function saveCategories() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    syncProductsFromCategories();
}

function saveTemplates() {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
}

function saveProducts() {
    // Совместимость с внешними изменениями товаров
    products.forEach(p => {
        const cat = categories.find(c => c.id === p.categoryId);
        if (cat) {
            cat.isProduct = true;
            cat.description = p.description;
            cat.templateId = p.templateId;
            cat.sourceLang = p.sourceLang;
            cat.targetLang = p.targetLang;
            cat.basePrice = p.basePrice;
            cat.components = p.components;
        }
    });
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
}

function saveLanguages() {
    localStorage.setItem(STORAGE_KEYS.LANGUAGES, JSON.stringify(languages));
}

function generateUniqueId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
}

// Рекурсивный подъем по иерархии категорий до корня с защитой от бесконечных петель
function getCategoryPathIds(categoryId) {
    let path = [];
    let currentId = categoryId;
    let visited = new Set();
    while (currentId) {
        if (visited.has(currentId)) {
            console.error("Цикл обнаружен в путях категорий для ID:", currentId);
            break;
        }
        visited.add(currentId);
        const cat = categories.find(c => c.id === currentId);
        if (cat) {
            path.unshift(cat.id);
            currentId = cat.parentId;
        } else {
            break;
        }
    }
    return path;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.store = {
    get categories() { return categories; },
    set categories(val) { categories = val; },
    get templates() { return templates; },
    set templates(val) { templates = val; },
    get products() { return products; },
    set products(val) { products = val; },
    get languages() { return languages; },
    set languages(val) { languages = val; },
    initStore,
    saveCategories,
    saveTemplates,
    saveProducts,
    saveLanguages,
    generateUniqueId,
    getCategoryPathIds,
    escapeHtml,
    syncProductsFromCategories
};

store.initStore();