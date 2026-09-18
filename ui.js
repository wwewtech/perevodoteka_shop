(() => {
    const widgets = new Map();
    const baselines = new WeakMap();
    const formatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
    let activeWidget = null;
    let dialog = null;
    let pendingConfirm = null;
    let leaving = false;
    const element = value => typeof value === 'string' ? document.getElementById(value) : value;
    const snapshot = form => JSON.stringify([...form.elements].filter(field => field.matches('input:not(.choice-input),select,textarea')).map(field => [field.id || field.name, field.type === 'checkbox' ? field.checked : field.value]));
    const dirtyForms = () => [...document.forms].filter(form => baselines.has(form) && snapshot(form) !== baselines.get(form));

    function toast(message) {
        let region = document.getElementById('feedback-region');
        if (!region) {
            region = document.createElement('div');
            region.id = 'feedback-region';
            region.className = 'feedback-region';
            region.setAttribute('role', 'status');
            region.setAttribute('aria-live', 'polite');
            document.body.append(region);
        }
        const item = document.createElement('div');
        item.className = 'feedback-message';
        const text = document.createElement('span');
        text.textContent = message;
        const close = document.createElement('button');
        close.type = 'button';
        close.setAttribute('aria-label', 'Закрыть сообщение');
        close.textContent = '×';
        close.onclick = () => item.remove();
        item.append(text, close);
        region.append(item);
        while (region.children.length > 3) region.firstElementChild.remove();
        setTimeout(() => { if (!item.contains(document.activeElement)) item.remove(); }, 9000);
    }

    function confirmAction({ title = 'Подтвердите действие', message = '', confirmText = 'Удалить', danger = true } = {}) {
        if (pendingConfirm) return Promise.resolve(false);
        activeWidget?.close();
        const previous = document.activeElement;
        dialog = document.createElement('dialog');
        dialog.className = 'confirm-dialog';
        dialog.setAttribute('aria-labelledby', 'confirm-title');
        dialog.setAttribute('aria-describedby', 'confirm-message');
        dialog.innerHTML = '<div class="dialog-content"><p class="dialog-eyebrow">Подтверждение</p><h2 id="confirm-title"></h2><p id="confirm-message"></p><div class="dialog-actions"><button type="button" class="secondary-button" data-cancel>Отмена</button><button type="button" data-confirm></button></div></div>';
        dialog.querySelector('h2').textContent = title;
        dialog.querySelector('#confirm-message').textContent = message;
        const confirmButton = dialog.querySelector('[data-confirm]');
        confirmButton.textContent = confirmText;
        confirmButton.className = danger ? 'danger-button' : 'primary-link';
        document.body.append(dialog);
        return new Promise(resolve => {
            pendingConfirm = resolve;
            const finish = accepted => {
                const current = dialog;
                pendingConfirm = null;
                dialog = null;
                current.close();
                current.remove();
                if (previous?.isConnected) previous.focus({ preventScroll: true });
                resolve(accepted);
            };
            dialog.querySelector('[data-cancel]').onclick = () => finish(false);
            confirmButton.onclick = () => finish(true);
            dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
            dialog.showModal();
            dialog.querySelector('[data-cancel]').focus();
        });
    }

    function clearError(field) {
        const id = field.dataset.errorId;
        if (id) {
            document.getElementById(id)?.remove();
            const descriptions = (field.getAttribute('aria-describedby') || '').split(' ').filter(value => value && value !== id);
            if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' '));
            else field.removeAttribute('aria-describedby');
            delete field.dataset.errorId;
        }
        field.removeAttribute('aria-invalid');
        widgets.get(field)?.sync();
    }

    function error(value, message) {
        const field = element(value);
        if (!field) return toast(message);
        clearError(field);
        const note = document.createElement('p');
        note.id = `${field.id || 'field'}-error`;
        note.className = 'field-error';
        note.textContent = message;
        note.setAttribute('role', 'alert');
        const target = widgets.get(field)?.wrapper || field;
        target.insertAdjacentElement('afterend', note);
        field.dataset.errorId = note.id;
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
        widgets.get(field)?.sync();
        const focusTarget = widgets.get(field)?.input || field;
        focusTarget.focus();
        focusTarget.scrollIntoView({ block: 'nearest' });
    }

    class Choice {
        constructor(select) {
            this.select = select;
            this.opened = false;
            this.results = [];
            this.activeIndex = -1;
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'choice';
            select.before(this.wrapper);
            this.wrapper.append(select);
            select.classList.add('choice-native');
            select.tabIndex = -1;
            select.setAttribute('aria-hidden', 'true');
            this.input = document.createElement('input');
            this.input.type = 'text';
            this.input.id = `${select.id}-choice`;
            this.input.className = 'choice-input';
            this.input.autocomplete = 'off';
            this.input.spellcheck = false;
            this.input.setAttribute('role', 'combobox');
            this.input.setAttribute('aria-autocomplete', 'list');
            this.input.setAttribute('aria-expanded', 'false');
            this.input.setAttribute('aria-controls', `${select.id}-options`);
            this.input.placeholder = 'Выберите или найдите…';
            const labels = [...select.labels];
            labels.forEach(label => { label.htmlFor = this.input.id; });
            if (!labels.length) this.input.setAttribute('aria-label', select.getAttribute('aria-label') || 'Выбор значения');
            this.arrow = document.createElement('button');
            this.arrow.type = 'button';
            this.arrow.className = 'choice-toggle';
            this.arrow.tabIndex = -1;
            this.arrow.setAttribute('aria-label', 'Открыть список');
            this.arrow.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg>';
            this.popup = document.createElement('div');
            this.popup.className = 'choice-popup';
            this.popup.hidden = true;
            this.popup.innerHTML = '<div class="choice-caption">Введите название для поиска</div><div class="choice-options" role="listbox"></div><p class="choice-empty" role="status" hidden>Ничего не найдено. Попробуйте другое название.</p>';
            this.list = this.popup.querySelector('[role="listbox"]');
            this.list.id = `${select.id}-options`;
            this.list.setAttribute('aria-label', labels.map(label => label.textContent.trim()).join(' ') || 'Варианты');
            this.wrapper.append(this.input, this.arrow);
            document.body.append(this.popup);
            this.input.addEventListener('click', () => { if (!this.opened) this.open(); });
            this.arrow.addEventListener('click', () => { this.input.focus(); this.opened ? this.close() : this.open(); });
            this.input.addEventListener('input', () => { if (!this.opened) this.open(false); this.render(this.input.value); });
            this.input.addEventListener('keydown', event => this.keydown(event));
            this.input.addEventListener('blur', () => setTimeout(() => { if (!this.wrapper.contains(document.activeElement) && !this.popup.contains(document.activeElement)) this.close(); }, 0));
            this.popup.addEventListener('mousedown', event => event.preventDefault());
            this.list.addEventListener('click', event => {
                const option = event.target.closest('[data-option-index]');
                if (option) this.choose(Number(option.dataset.optionIndex));
            });
            select.addEventListener('change', () => this.sync());
            select.addEventListener('focus', () => this.input.focus());
            select.addEventListener('invalid', event => { event.preventDefault(); error(select, 'Выберите значение из списка.'); });
            this.observer = new MutationObserver(() => this.sync());
            this.observer.observe(select, { childList: true, subtree: true, attributes: true });
            this.sync();
        }
        sync() {
            const selected = this.select.selectedOptions[0];
            if (!this.opened) this.input.value = selected?.textContent.trim() || '';
            this.input.disabled = this.select.disabled;
            this.arrow.disabled = this.select.disabled;
            this.input.setAttribute('aria-required', String(this.select.required));
            ['aria-invalid', 'aria-describedby'].forEach(attr => {
                const value = this.select.getAttribute(attr);
                if (value) this.input.setAttribute(attr, value);
                else this.input.removeAttribute(attr);
            });
            this.wrapper.classList.toggle('has-value', Boolean(this.select.value));
            this.input.title = selected?.textContent.trim() || '';
            if (this.opened) this.render(this.query || '');
        }
        open(clear = true) {
            if (this.select.disabled) return;
            if (activeWidget && activeWidget !== this) activeWidget.close();
            activeWidget = this;
            this.opened = true;
            this.popup.hidden = false;
            this.wrapper.classList.add('is-open');
            this.input.setAttribute('aria-expanded', 'true');
            if (clear) { this.input.value = ''; this.query = ''; }
            this.render(clear ? '' : this.input.value);
            this.position();
        }
        position() {
            if (!this.opened) return;
            const bounds = this.wrapper.getBoundingClientRect();
            const viewport = window.visualViewport;
            const height = viewport?.height || innerHeight;
            const offset = viewport?.offsetTop || 0;
            const availableBelow = height + offset - bounds.bottom - 12;
            const availableAbove = bounds.top - offset - 12;
            const above = availableBelow < 180 && availableAbove > availableBelow;
            const maxHeight = Math.max(100, Math.min(330, above ? availableAbove : availableBelow));
            const width = Math.min(Math.max(bounds.width, 260), innerWidth - 24);
            this.popup.style.width = `${width}px`;
            this.popup.style.left = `${Math.max(12, Math.min(bounds.left, innerWidth - width - 12))}px`;
            this.popup.style.maxHeight = `${maxHeight}px`;
            this.popup.style.top = above ? 'auto' : `${bounds.bottom + 6}px`;
            this.popup.style.bottom = above ? `${innerHeight - bounds.top + 6}px` : 'auto';
        }
        render(query) {
            this.query = query;
            const normalized = query.toLocaleLowerCase('ru').trim();
            this.results = [...this.select.options].filter(option => !option.disabled && !option.hidden && option.textContent.toLocaleLowerCase('ru').includes(normalized));
            this.list.replaceChildren();
            const fragment = document.createDocumentFragment();
            this.results.forEach((option, index) => {
                const row = document.createElement('div');
                row.id = `${this.select.id}-option-${index}`;
                row.className = 'choice-option';
                row.setAttribute('role', 'option');
                row.setAttribute('aria-selected', String(option.selected));
                row.dataset.optionIndex = index;
                const name = document.createElement('span');
                name.textContent = option.textContent.trim();
                const check = document.createElement('span');
                check.className = 'choice-check';
                check.setAttribute('aria-hidden', 'true');
                check.textContent = option.selected ? '✓' : '';
                row.append(name, check);
                fragment.append(row);
            });
            this.list.append(fragment);
            this.popup.querySelector('.choice-empty').hidden = this.results.length > 0;
            this.activeIndex = normalized ? (this.results.length ? 0 : -1) : this.results.findIndex(option => option.selected);
            this.highlight();
        }
        highlight() {
            [...this.list.children].forEach((row, index) => row.classList.toggle('is-focused', index === this.activeIndex));
            const row = this.list.children[this.activeIndex];
            if (row) {
                this.input.setAttribute('aria-activedescendant', row.id);
                row.scrollIntoView({ block: 'nearest' });
            } else this.input.removeAttribute('aria-activedescendant');
        }
        choose(index) {
            const option = this.results[index];
            if (!option) return;
            const previous = this.select.value;
            this.select.value = option.value;
            this.close();
            this.input.focus({ preventScroll: true });
            if (previous !== option.value) {
                clearError(this.select);
                this.select.dispatchEvent(new Event('input', { bubbles: true }));
                this.select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        close() {
            if (!this.opened) return;
            this.opened = false;
            this.popup.hidden = true;
            this.wrapper.classList.remove('is-open');
            this.input.setAttribute('aria-expanded', 'false');
            this.input.removeAttribute('aria-activedescendant');
            if (activeWidget === this) activeWidget = null;
            this.sync();
        }
        keydown(event) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!this.opened) { this.open(); return; }
                this.activeIndex = Math.max(0, Math.min(this.results.length - 1, this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
                this.highlight();
            } else if (event.key === 'Enter' && this.opened) {
                event.preventDefault();
                this.choose(this.activeIndex);
            } else if (event.key === 'Escape' && this.opened) {
                event.preventDefault();
                event.stopPropagation();
                this.close();
            } else if (event.key === 'Tab') this.close();
        }
    }

    function sync() {
        document.querySelectorAll('select:not([multiple])').forEach(select => {
            if (!widgets.has(select)) widgets.set(select, new Choice(select));
            else widgets.get(select).sync();
        });
    }
    function markClean(value) {
        const form = element(value);
        if (!form) return;
        baselines.set(form, snapshot(form));
        form.querySelectorAll('[aria-invalid="true"]').forEach(clearError);
        sync();
        updateDirtyStatus();
    }
    function updateDirtyStatus() {
        document.forms && [...document.forms].forEach(form => {
            const dirty = baselines.has(form) && snapshot(form) !== baselines.get(form);
            form.classList.toggle('has-unsaved-changes', dirty);
            const status = form.querySelector('.form-save-state');
            if (status) status.textContent = dirty ? 'Есть несохранённые изменения' : '';
        });
    }
    async function discard(value) {
        const form = element(value);
        if (!form || !baselines.has(form) || snapshot(form) === baselines.get(form)) return true;
        return confirmAction({ title: 'Оставить изменения без сохранения?', message: 'Введённые данные будут потеряны. Отмените действие, чтобы продолжить редактирование.', confirmText: 'Не сохранять', danger: true });
    }

    window.UX = { sync, markClean, discard, confirm: confirmAction, toast, error, formatPrice: value => formatter.format(Number(value) || 0), isDirty: value => { const form = element(value); return Boolean(form && baselines.has(form) && snapshot(form) !== baselines.get(form)); } };
    document.addEventListener('pointerdown', event => { if (activeWidget && !activeWidget.wrapper.contains(event.target) && !activeWidget.popup.contains(event.target)) activeWidget.close(); });
    window.addEventListener('resize', () => activeWidget?.position());
    window.visualViewport?.addEventListener('resize', () => activeWidget?.position());
    document.addEventListener('scroll', event => { if (activeWidget && !activeWidget.popup.contains(event.target)) activeWidget.position(); }, true);
    document.addEventListener('input', event => { if (!event.target.matches('.choice-input') && event.target.matches('input,textarea,select')) clearError(event.target); queueMicrotask(updateDirtyStatus); });
    document.addEventListener('change', () => queueMicrotask(updateDirtyStatus));
    document.addEventListener('reset', () => setTimeout(() => { sync(); updateDirtyStatus(); }, 0));
    document.addEventListener('submit', event => {
        if (store.readOnly || store.stale) {
            event.preventDefault(); event.stopImmediatePropagation();
            toast(store.stale ? 'Данные изменились в другой вкладке. Обновите страницу перед сохранением.' : 'Сохранение недоступно: проверьте сообщение о хранилище.');
        }
    }, true);
    document.addEventListener('click', async event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 || link.target === '_blank' || link.hasAttribute('download')) return;
        const url = new URL(link.href, location.href);
        if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
        if (!dirtyForms().length) return;
        event.preventDefault();
        if (await confirmAction({ title: 'Перейти без сохранения?', message: 'На странице есть несохранённые изменения. Сохраните их или продолжите без сохранения.', confirmText: 'Перейти', danger: true })) { leaving = true; location.href = link.href; }
    });
    window.addEventListener('beforeunload', event => { if (!leaving && dirtyForms().length) { event.preventDefault(); event.returnValue = ''; } });
    function storageNotice(message) {
        let notice = document.getElementById('storage-notice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'storage-notice';
            notice.className = 'storage-notice';
            notice.setAttribute('role', 'alert');
            document.querySelector('main').prepend(notice);
        }
        notice.textContent = message;
        if (store.stale) {
            const reload = document.createElement('button');
            reload.type = 'button'; reload.className = 'secondary-button'; reload.textContent = 'Обновить страницу';
            reload.onclick = async () => {
                if (!dirtyForms().length || await confirmAction({ title: 'Обновить данные?', message: 'Несохранённые изменения на этой странице будут потеряны.', confirmText: 'Обновить', danger: true })) { leaving = true; location.reload(); }
            };
            notice.append(reload);
        }
    }
    window.addEventListener('store:stale', () => storageNotice('Данные изменены в другой вкладке. Обновите страницу перед сохранением, чтобы не затереть изменения.'));
    window.addEventListener('error', event => { if (event.error) toast(event.error.message || 'Не удалось выполнить действие. Данные формы оставлены для повторной попытки.'); });
    window.addEventListener('unhandledrejection', event => toast(event.reason?.message || 'Действие не выполнено. Проверьте данные и повторите попытку.'));
    document.addEventListener('DOMContentLoaded', () => {
        queueMicrotask(() => {
            sync();
            [...document.forms].forEach(form => {
                form.noValidate = true;
                const status = document.createElement('p');
                status.className = 'form-save-state';
                status.setAttribute('role', 'status');
                form.append(status);
                if (!baselines.has(form)) markClean(form);
            });
            if (store.issues?.length) storageNotice(store.issues.join(' '));
            const observe = new MutationObserver(() => updateDirtyStatus());
            document.querySelectorAll('[id$="components-container"]').forEach(container => observe.observe(container, { childList: true }));
        });
    });
})();
