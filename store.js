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
let readOnly = false;
let stale = false;
let initialized = false;
const issues = [];

function reportIssue(message) {
    if (!issues.includes(message)) issues.push(message);
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalString(value) {
    return value == null || typeof value === 'string';
}

function isPrice(value) {
    return value == null || ((typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)));
}

function isValidItem(item, key) {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string') return false;
    if (key === STORAGE_KEYS.LANGUAGES) return typeof item.code === 'string';
    if (!['description', 'productName', 'parentId', 'templateId', 'sourceLang', 'targetLang'].every(field => isOptionalString(item[field]))) return false;
    if (key === STORAGE_KEYS.TEMPLATES && (typeof item.sourceLang !== 'string' || typeof item.targetLang !== 'string')) return false;
    if (item.isProduct != null && typeof item.isProduct !== 'boolean') return false;
    if (!isPrice(item.basePrice)) return false;
    if (item.components != null && (!Array.isArray(item.components) || !item.components.every(component =>
        isRecord(component) && typeof component.id === 'string' && typeof component.name === 'string' &&
        isPrice(component.additionalPrice) && (component.isRequired == null || typeof component.isRequired === 'boolean')
    ))) return false;
    if (key === STORAGE_KEYS.PRODUCTS && (!isOptionalString(item.categoryId) ||
        (item.categoryPathIds != null && (!Array.isArray(item.categoryPathIds) || !item.categoryPathIds.every(id => typeof id === 'string'))))) return false;
    return true;
}

function readArray(key) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return [];
        const value = JSON.parse(raw);
        if (!Array.isArray(value) || !value.every(item => isValidItem(item, key))) {
            throw new Error('Ожидался массив записей с корректными полями.');
        }
        return value;
    } catch (error) {
        readOnly = true;
        reportIssue(`Не удалось прочитать «${key}»: ${error.message || String(error)} Данные сохранены без изменений; запись заблокирована.`);
        return [];
    }
}

function assertWritable() {
    if (stale) throw new Error('Данные изменены в другой вкладке. Обновите страницу перед сохранением.');
    if (readOnly) throw new Error('Сохранение заблокировано: хранилище недоступно или содержит повреждённые данные. Проверьте хранилище и обновите страницу.');
}

function writeArray(key, value) {
    assertWritable();
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        const message = `Не удалось сохранить «${key}»: ${error.message || String(error)} Проверьте доступность и свободное место хранилища.`;
        reportIssue(message);
        throw new Error(message);
    }
}

function saveProductsCache() {
    if (readOnly || stale) return;
    try {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (error) {
        reportIssue(`Не удалось обновить совместимый кэш «products»: ${error.message || String(error)} Основные данные не затронуты.`);
    }
}

// Чтение строго пустых массивов по умолчанию, без дефолтных данных
function initStore() {
    if (initialized) return;
    initialized = true;
    categories = readArray(STORAGE_KEYS.CATEGORIES);
    templates = readArray(STORAGE_KEYS.TEMPLATES);
    languages = readArray(STORAGE_KEYS.LANGUAGES);
    readArray(STORAGE_KEYS.PRODUCTS);
    syncProductsFromCategories();
}

// Синхронизация: извлекаем товары напрямую из структуры конечных подкатегорий
function syncProductsFromCategories() {
    products = categories.filter(c => c.isProduct).map(c => ({
        id: c.id,
        name: c.productName || c.name,
        description: c.description || '',
        categoryId: c.id,
        categoryPathIds: getCategoryPathIds(c.id),
        templateId: c.templateId || null,
        sourceLang: c.sourceLang || '',
        targetLang: c.targetLang || '',
        basePrice: c.basePrice || 0,
        components: c.components || []
    }));
    saveProductsCache();
}

function saveCategories() {
    writeArray(STORAGE_KEYS.CATEGORIES, categories);
    syncProductsFromCategories();
}

function saveTemplates() {
    writeArray(STORAGE_KEYS.TEMPLATES, templates);
}

function saveProducts() {
    assertWritable();
    // Совместимость с внешними изменениями товаров
    products.forEach(p => {
        const cat = categories.find(c => c.id === p.categoryId);
        if (cat) {
            cat.isProduct = true;
            cat.productName = p.name;
            cat.description = p.description;
            cat.templateId = p.templateId;
            cat.sourceLang = p.sourceLang;
            cat.targetLang = p.targetLang;
            cat.basePrice = p.basePrice;
            cat.components = p.components;
        }
    });
    writeArray(STORAGE_KEYS.CATEGORIES, categories);
    saveProductsCache();
}

function saveLanguages() {
    writeArray(STORAGE_KEYS.LANGUAGES, languages);
}

function generateUniqueId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }
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

window.addEventListener('storage', event => {
    if (event.key !== null && ![STORAGE_KEYS.CATEGORIES, STORAGE_KEYS.TEMPLATES, STORAGE_KEYS.LANGUAGES].includes(event.key)) return;
    try {
        if (event.storageArea && event.storageArea !== localStorage) return;
    } catch (error) {
        readOnly = true;
        reportIssue(`Хранилище недоступно: ${error.message || String(error)} Запись заблокирована.`);
    }
    stale = true;
    window.dispatchEvent(new CustomEvent('store:stale', { detail: { key: event.key } }));
});

window.store = {
    get issues() { return issues; },
    get readOnly() { return readOnly; },
    get stale() { return stale; },
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