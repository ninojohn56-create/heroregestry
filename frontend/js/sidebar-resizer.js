/**
 * GHRMS Unified Resizable & Collapsible Sidebar Engine
 * Supports Mouse + Touch dragging, localStorage persistence, keyboard shortcuts,
 * double-click reset, and responsive safeguards.
 */
(function(window) {
  'use strict';

  const SidebarEngine = {
    /**
     * Initializes a standard navigation sidebar (used in Registrar, Hero, Registry)
     */
    initNavSidebar: function(options) {
      const {
        sidebarId,
        resizerId,
        toggleBtnId,
        storageKey = 'ghrms_nav_sidebar',
        minWidth = 160,
        maxWidth = 480,
        defaultWidth = 220
      } = options;

      const sidebar = document.getElementById(sidebarId);
      const resizer = document.getElementById(resizerId);
      const toggleBtn = document.getElementById(toggleBtnId);

      if (!sidebar) return;

      const widthKey = `${storageKey}_width`;
      const collapsedKey = `${storageKey}_collapsed`;

      // 1. Restore saved state
      const savedCollapsed = localStorage.getItem(collapsedKey) === 'true';
      const savedWidth = parseInt(localStorage.getItem(widthKey), 10);

      if (savedCollapsed) {
        sidebar.classList.add('collapsed');
        if (toggleBtn) {
          const icon = toggleBtn.querySelector('.collapse-icon');
          if (icon) icon.textContent = '▶';
          toggleBtn.setAttribute('title', 'Expand Sidebar');
        }
      } else if (!isNaN(savedWidth) && savedWidth >= minWidth && savedWidth <= maxWidth) {
        sidebar.style.width = savedWidth + 'px';
        sidebar.style.minWidth = savedWidth + 'px';
        sidebar.style.setProperty('--sidebar-width', savedWidth + 'px');
      }

      // 2. Collapse Toggle Handler
      function toggleCollapse(forceState) {
        const isCollapsed = sidebar.classList.contains('collapsed');
        const nextState = (typeof forceState === 'boolean') ? forceState : !isCollapsed;

        if (nextState) {
          sidebar.classList.add('collapsed');
          localStorage.setItem(collapsedKey, 'true');
          if (toggleBtn) {
            const icon = toggleBtn.querySelector('.collapse-icon');
            if (icon) icon.textContent = '▶';
            toggleBtn.setAttribute('title', 'Expand Sidebar');
          }
        } else {
          sidebar.classList.remove('collapsed');
          localStorage.setItem(collapsedKey, 'false');
          const currentWidth = parseInt(sidebar.style.width, 10) || defaultWidth;
          sidebar.style.width = currentWidth + 'px';
          sidebar.style.minWidth = currentWidth + 'px';
          sidebar.style.setProperty('--sidebar-width', currentWidth + 'px');
          if (toggleBtn) {
            const icon = toggleBtn.querySelector('.collapse-icon');
            if (icon) icon.textContent = '◀';
            toggleBtn.setAttribute('title', 'Collapse Sidebar');
          }
        }
      }

      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleCollapse();
        });
      }

      // 3. Resizer Drag Handling
      if (resizer) {
        let isDragging = false;
        let startX = 0;
        let startWidth = 0;

        function onPointerDown(e) {
          if (sidebar.classList.contains('collapsed')) {
            // Clicking resizer while collapsed uncollapses
            toggleCollapse(false);
            return;
          }
          isDragging = true;
          startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
          startWidth = sidebar.getBoundingClientRect().width;

          sidebar.classList.add('is-resizing');
          resizer.classList.add('resizing');
          document.body.classList.add('resizing-active');

          window.addEventListener('mousemove', onPointerMove, { passive: false });
          window.addEventListener('mouseup', onPointerUp);
          window.addEventListener('touchmove', onPointerMove, { passive: false });
          window.addEventListener('touchend', onPointerUp);
          e.preventDefault();
        }

        function onPointerMove(e) {
          if (!isDragging) return;
          const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
          const diff = currentX - startX;
          let newWidth = startWidth + diff;

          // Clamp
          if (newWidth < minWidth) newWidth = minWidth;
          if (newWidth > maxWidth) newWidth = maxWidth;

          sidebar.style.width = newWidth + 'px';
          sidebar.style.minWidth = newWidth + 'px';
          sidebar.style.setProperty('--sidebar-width', newWidth + 'px');
          e.preventDefault();
        }

        function onPointerUp() {
          if (!isDragging) return;
          isDragging = false;
          sidebar.classList.remove('is-resizing');
          resizer.classList.remove('resizing');
          document.body.classList.remove('resizing-active');

          const finalWidth = Math.round(sidebar.getBoundingClientRect().width);
          localStorage.setItem(widthKey, finalWidth.toString());

          window.removeEventListener('mousemove', onPointerMove);
          window.removeEventListener('mouseup', onPointerUp);
          window.removeEventListener('touchmove', onPointerMove);
          window.removeEventListener('touchend', onPointerUp);
        }

        resizer.addEventListener('mousedown', onPointerDown);
        resizer.addEventListener('touchstart', onPointerDown, { passive: false });

        // Double click to reset width
        resizer.addEventListener('dblclick', () => {
          sidebar.style.width = defaultWidth + 'px';
          sidebar.style.minWidth = defaultWidth + 'px';
          sidebar.style.setProperty('--sidebar-width', defaultWidth + 'px');
          localStorage.setItem(widthKey, defaultWidth.toString());
          if (sidebar.classList.contains('collapsed')) {
            toggleCollapse(false);
          }
        });
      }

      // Keyboard Shortcut (Ctrl+B / Cmd+B)
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
          const activeTag = document.activeElement ? document.activeElement.tagName : '';
          if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
            e.preventDefault();
            toggleCollapse();
          }
        }
      });

      return {
        toggleCollapse,
        getWidth: () => sidebar.getBoundingClientRect().width
      };
    },

    /**
     * Initializes split-panel resizer between center work area and side panels
     * (Used for Registrar Details Panel and Sentinel Scanner Panel)
     */
    initSplitPanel: function(options) {
      const {
        panelId,
        resizerId,
        collapseBtnId,
        restoreBtnId,
        storageKey,
        isRightPanel = false,
        minWidth = 280,
        maxWidth = 650,
        defaultWidth = 360,
        cssVarName = '--details-panel-width',
        collapsedWidth = 0
      } = options;

      const panel = document.getElementById(panelId);
      const resizer = document.getElementById(resizerId);
      const collapseBtn = document.getElementById(collapseBtnId);
      const restoreBtn = document.getElementById(restoreBtnId);

      if (!panel) return;

      const widthKey = `${storageKey}_width`;
      const collapsedKey = `${storageKey}_collapsed`;

      // Restore saved state
      const savedCollapsed = localStorage.getItem(collapsedKey) === 'true';
      const savedWidth = parseInt(localStorage.getItem(widthKey), 10);

      function applyCollapseState(isCollapsed) {
        if (isCollapsed) {
          panel.classList.add('collapsed');
          if (restoreBtn) restoreBtn.style.display = 'inline-flex';
          if (collapseBtn) collapseBtn.setAttribute('title', 'Expand Panel');
          if (resizer) resizer.style.display = 'none';
        } else {
          panel.classList.remove('collapsed');
          if (restoreBtn) restoreBtn.style.display = 'none';
          if (collapseBtn) collapseBtn.setAttribute('title', 'Collapse Panel');
          if (resizer) resizer.style.display = '';
        }
      }

      if (savedCollapsed) {
        applyCollapseState(true);
      } else if (!isNaN(savedWidth) && savedWidth >= minWidth && savedWidth <= maxWidth) {
        panel.style.width = savedWidth + 'px';
        panel.style.setProperty(cssVarName, savedWidth + 'px');
      }

      function toggleCollapse(forceState) {
        const isCollapsed = panel.classList.contains('collapsed');
        const nextState = (typeof forceState === 'boolean') ? forceState : !isCollapsed;
        applyCollapseState(nextState);
        localStorage.setItem(collapsedKey, nextState ? 'true' : 'false');
      }

      if (collapseBtn) {
        collapseBtn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleCollapse(true);
        });
      }

      if (restoreBtn) {
        restoreBtn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleCollapse(false);
        });
      }

      // Drag Resizing
      if (resizer) {
        let isDragging = false;
        let startX = 0;
        let startWidth = 0;

        function onPointerDown(e) {
          if (panel.classList.contains('collapsed')) {
            toggleCollapse(false);
            return;
          }
          isDragging = true;
          startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
          startWidth = panel.getBoundingClientRect().width;

          panel.classList.add('is-resizing');
          resizer.classList.add('resizing');
          document.body.classList.add('resizing-active');

          window.addEventListener('mousemove', onPointerMove, { passive: false });
          window.addEventListener('mouseup', onPointerUp);
          window.addEventListener('touchmove', onPointerMove, { passive: false });
          window.addEventListener('touchend', onPointerUp);
          e.preventDefault();
        }

        function onPointerMove(e) {
          if (!isDragging) return;
          const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
          const diff = currentX - startX;
          // For right panel: dragging left increases width
          const newWidth = isRightPanel ? (startWidth - diff) : (startWidth + diff);

          const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
          panel.style.width = clampedWidth + 'px';
          panel.style.setProperty(cssVarName, clampedWidth + 'px');
          e.preventDefault();
        }

        function onPointerUp() {
          if (!isDragging) return;
          isDragging = false;
          panel.classList.remove('is-resizing');
          resizer.classList.remove('resizing');
          document.body.classList.remove('resizing-active');

          const finalWidth = Math.round(panel.getBoundingClientRect().width);
          localStorage.setItem(widthKey, finalWidth.toString());

          window.removeEventListener('mousemove', onPointerMove);
          window.removeEventListener('mouseup', onPointerUp);
          window.removeEventListener('touchmove', onPointerMove);
          window.removeEventListener('touchend', onPointerUp);
        }

        resizer.addEventListener('mousedown', onPointerDown);
        resizer.addEventListener('touchstart', onPointerDown, { passive: false });

        resizer.addEventListener('dblclick', () => {
          panel.style.width = defaultWidth + 'px';
          panel.style.setProperty(cssVarName, defaultWidth + 'px');
          localStorage.setItem(widthKey, defaultWidth.toString());
          if (panel.classList.contains('collapsed')) {
            toggleCollapse(false);
          }
        });
      }

      return {
        toggleCollapse
      };
    },

    /**
     * Initializes Admin Command Center Sidebar Resize
     */
    initAdminSidebar: function(options = {}) {
      const sidebar = document.getElementById('sidebar');
      const resizer = document.getElementById('admin-sidebar-resizer');
      if (!sidebar) return;

      const widthKey = 'ghrms_admin_sidebar_width';
      const minWidth = 200;
      const maxWidth = 480;
      const defaultWidth = 256;

      // Restore saved width if not collapsed
      const isCollapsed = sidebar.classList.contains('sidebar-collapsed');
      const savedWidth = parseInt(localStorage.getItem(widthKey), 10);
      if (!isCollapsed && !isNaN(savedWidth) && savedWidth >= minWidth && savedWidth <= maxWidth) {
        sidebar.style.width = savedWidth + 'px';
        sidebar.style.minWidth = savedWidth + 'px';
      }

      if (resizer) {
        let isDragging = false;
        let startX = 0;
        let startWidth = 0;

        function onPointerDown(e) {
          if (sidebar.classList.contains('sidebar-collapsed')) {
            if (typeof window.toggleSidebarCollapse === 'function') {
              window.toggleSidebarCollapse();
            }
            return;
          }
          isDragging = true;
          startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
          startWidth = sidebar.getBoundingClientRect().width;

          sidebar.style.transition = 'none';
          resizer.classList.add('resizing');
          document.body.classList.add('resizing-active');

          window.addEventListener('mousemove', onPointerMove, { passive: false });
          window.addEventListener('mouseup', onPointerUp);
          window.addEventListener('touchmove', onPointerMove, { passive: false });
          window.addEventListener('touchend', onPointerUp);
          e.preventDefault();
        }

        function onPointerMove(e) {
          if (!isDragging) return;
          const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
          const diff = currentX - startX;
          let newWidth = startWidth + diff;

          if (newWidth < minWidth) newWidth = minWidth;
          if (newWidth > maxWidth) newWidth = maxWidth;

          sidebar.style.width = newWidth + 'px';
          sidebar.style.minWidth = newWidth + 'px';
          e.preventDefault();
        }

        function onPointerUp() {
          if (!isDragging) return;
          isDragging = false;
          sidebar.style.transition = '';
          resizer.classList.remove('resizing');
          document.body.classList.remove('resizing-active');

          const finalWidth = Math.round(sidebar.getBoundingClientRect().width);
          localStorage.setItem(widthKey, finalWidth.toString());

          window.removeEventListener('mousemove', onPointerMove);
          window.removeEventListener('mouseup', onPointerUp);
          window.removeEventListener('touchmove', onPointerMove);
          window.removeEventListener('touchend', onPointerUp);
        }

        resizer.addEventListener('mousedown', onPointerDown);
        resizer.addEventListener('touchstart', onPointerDown, { passive: false });

        resizer.addEventListener('dblclick', () => {
          sidebar.style.width = defaultWidth + 'px';
          sidebar.style.minWidth = defaultWidth + 'px';
          localStorage.setItem(widthKey, defaultWidth.toString());
          if (sidebar.classList.contains('sidebar-collapsed')) {
            if (typeof window.toggleSidebarCollapse === 'function') {
              window.toggleSidebarCollapse();
            }
          }
        });
      }
    }
  };

  window.GHRMSSidebarEngine = SidebarEngine;
})(window);
