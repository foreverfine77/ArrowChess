export function enhanceSelectMenus(selects: readonly HTMLSelectElement[]): () => void {
  let openMenu: { element: HTMLElement; close: () => void } | undefined;

  const syncMenus = selects.map(select => {
    const label = select.labels?.[0];
    const menu = document.createElement('div');
    const trigger = document.createElement('button');
    const value = document.createElement('span');
    const list = document.createElement('div');
    menu.className = 'select-menu';
    trigger.type = 'button';
    trigger.className = 'select-trigger';
    trigger.id = `${select.id}-trigger`;
    list.id = `${select.id}-options`;
    list.className = 'select-list';
    list.setAttribute('role', 'listbox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', list.id);
    trigger.setAttribute('aria-expanded', 'false');
    if (label) {
      label.id = `${select.id}-label`;
      label.htmlFor = trigger.id;
      value.id = `${select.id}-value`;
      trigger.setAttribute('aria-labelledby', `${label.id} ${value.id}`);
      list.setAttribute('aria-labelledby', label.id);
    }
    list.inert = true;

    function close(restoreFocus = false): void {
      if (openMenu?.element !== menu) return;
      openMenu = undefined;
      if (restoreFocus && !trigger.disabled) trigger.focus({preventScroll: true});
      delete menu.dataset.open;
      list.inert = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    const options = Array.from(select.options, (option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.className = 'select-option';
      button.setAttribute('role', 'option');
      button.textContent = option.text;
      button.addEventListener('click', () => {
        const changed = select.selectedIndex !== index;
        select.selectedIndex = index;
        close(true);
        sync();
        if (changed) select.dispatchEvent(new Event('change', {bubbles: true}));
      });
      button.addEventListener('keydown', event => {
        let next: number;
        switch (event.key) {
          case 'ArrowDown': next = Math.min(index + 1, options.length - 1); break;
          case 'ArrowUp': next = Math.max(index - 1, 0); break;
          case 'Home': next = 0; break;
          case 'End': next = options.length - 1; break;
          case 'Escape': event.preventDefault(); close(true); return;
          case 'Tab': close(true); return;
          default: return;
        }
        event.preventDefault();
        options[next].focus();
      });
      list.appendChild(button);
      return button;
    });

    function sync(): void {
      trigger.disabled = select.disabled;
      if (trigger.disabled) close();
      value.textContent = select.selectedOptions[0]?.text ?? '';
      options.forEach((button, index) => {
        button.setAttribute('aria-selected', String(index === select.selectedIndex));
      });
    }

    function open(): void {
      if (trigger.disabled) return;
      openMenu?.close();
      const rect = trigger.getBoundingClientRect();
      const above = rect.top - 12;
      const below = window.innerHeight - rect.bottom - 12;
      const opensAbove = below < options.length * 44 + 10 && above > below;
      menu.dataset.side = opensAbove ? 'above' : 'below';
      list.style.maxHeight = `${Math.max(44, opensAbove ? above : below)}px`;
      openMenu = {element: menu, close};
      menu.dataset.open = '';
      list.inert = false;
      trigger.setAttribute('aria-expanded', 'true');
      options[Math.max(0, select.selectedIndex)].focus({preventScroll: true});
    }

    trigger.addEventListener('click', () => {
      if (openMenu?.element === menu) close();
      else open();
    });
    trigger.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      open();
    });
    select.addEventListener('change', sync);
    trigger.appendChild(value);
    menu.append(trigger, list);
    select.after(menu);
    select.hidden = true;
    sync();
    return sync;
  });

  const closeOutside = (event: Event) => {
    if (openMenu && event.target instanceof Node && !openMenu.element.contains(event.target)) openMenu.close();
  };
  document.addEventListener('pointerdown', closeOutside);
  document.addEventListener('focusin', closeOutside);
  return () => syncMenus.forEach(sync => sync());
}
