(function() {
  const ROLE_KEY = 'app_user_role';
  const ALWAYS_ALLOWED = new Set(['', 'index.html', 'login.html']);
  const ROLE_MAP = {
    'admin': 'admin',
    'full': 'admin',
    'superuser': 'admin',
    'opd': 'opd',
    'nurseopd': 'opd',
    'nurseopd9': 'opd',
    'ipd': 'ipd',
    'nurseipd': 'ipd'
  };
  const PAGE_RULES = {
    opd: [
      'index.html',
      'dashboard.html',
      'predict.html',
      'booking.html',
      'booking-patient-info.html',
      'registry.html',
      'data-archive.html',
      'ipd.html'
    ],
    ipd: [
      'index.html',
      'dashboard.html',
      'ipd.html',
      'data-archive.html'
    ]
  };
  const READ_ONLY_PAGES = {
    opd: new Set()
  };
  const READ_ONLY_TITLE = 'สำหรับดูสถานะเท่านั้น';

  function normalizeRole(rawValue) {
    if (!rawValue) {
      return '';
    }
    const key = String(rawValue).toLowerCase();
    return ROLE_MAP[key] || '';
  }

  function detectRole() {
    const storedRole = normalizeRole(sessionStorage.getItem(ROLE_KEY) || localStorage.getItem(ROLE_KEY));
    if (storedRole) {
      return storedRole;
    }

    const legacyRole = normalizeRole(sessionStorage.getItem('sbp_loginrole') || localStorage.getItem('sbp_loginrole'));
    if (legacyRole) {
      return legacyRole;
    }

    if (sessionStorage.getItem('superuser') || localStorage.getItem('superuser')) {
      return 'admin';
    }
    if (sessionStorage.getItem('nurseipd') || localStorage.getItem('nurseipd')) {
      return 'ipd';
    }
    if (
      sessionStorage.getItem('nurseopd') ||
      localStorage.getItem('nurseopd') ||
      sessionStorage.getItem('nurseopd9') ||
      localStorage.getItem('nurseopd9')
    ) {
      return 'opd';
    }

    return '';
  }

  function getUserRole() {
    const role = detectRole();
    if (role) {
      sessionStorage.setItem(ROLE_KEY, role);
    }
    return role;
  }

  function getAllowedPages(role) {
    if (role === 'admin') {
      return null;
    }
    return PAGE_RULES[role] || [];
  }

  function pageFromHref(href) {
    if (!href) {
      return '';
    }
    const cleanHref = href.split('#')[0].split('?')[0];
    if (!cleanHref) {
      return '';
    }
    const parts = cleanHref.split('/');
    return parts[parts.length - 1];
  }

  function getCurrentPage() {
    const path = window.location.pathname || '';
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    if (!lastPart) {
      return 'index.html';
    }
    return lastPart;
  }

  function isPageAllowedForRole(role, page) {
    if (!role) {
      return true;
    }
    if (!page) {
      return true;
    }
    if (ALWAYS_ALLOWED.has(page)) {
      return true;
    }
    if (role === 'admin') {
      return true;
    }
    const allowed = getAllowedPages(role);
    return Array.isArray(allowed) && allowed.indexOf(page) !== -1;
  }

  function isReadOnlyPage(role, page) {
    if (!role || !page) {
      return false;
    }
    const readonlySet = READ_ONLY_PAGES[role];
    return readonlySet instanceof Set && readonlySet.has(page);
  }

  function preventReadOnlyActivation(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleReadOnlyKey(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      preventReadOnlyActivation(event);
    }
  }

  function applyReadOnlyState(link) {
    if (!link || link.dataset.sbpReadonly === 'true') {
      return;
    }
    const currentTitle = link.getAttribute('title');
    link.dataset.sbpReadonlyTitle = currentTitle != null ? currentTitle : '';
    link.dataset.sbpReadonly = 'true';
    link.classList.add('nav-button-readonly');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('tabindex', '-1');
    link.setAttribute('title', READ_ONLY_TITLE);
    link.addEventListener('click', preventReadOnlyActivation, true);
    link.addEventListener('keydown', handleReadOnlyKey, true);
  }

  function clearReadOnlyState(link) {
    if (!link || link.dataset.sbpReadonly !== 'true') {
      return;
    }
    const originalTitle = link.dataset.sbpReadonlyTitle;
    if (typeof originalTitle === 'string' && originalTitle) {
      link.setAttribute('title', originalTitle);
    } else {
      link.removeAttribute('title');
    }
    link.classList.remove('nav-button-readonly');
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.removeEventListener('click', preventReadOnlyActivation, true);
    link.removeEventListener('keydown', handleReadOnlyKey, true);
    delete link.dataset.sbpReadonlyTitle;
    delete link.dataset.sbpReadonly;
  }

  function enforceNavVisibility() {
    const role = getUserRole();
    const logoutBtn = document.getElementById('logoutBtn');

    if (!role) {
      if (logoutBtn) {
        logoutBtn.style.display = 'none';
        logoutBtn.onclick = null;
      }
      return;
    }

    if (logoutBtn) {
      logoutBtn.style.display = '';
      logoutBtn.onclick = function handleLogoutClick() {
        logout();
      };
    }

    const currentPage = getCurrentPage();
    if (!isPageAllowedForRole(role, currentPage)) {
      window.location.href = 'dashboard.html';
      return;
    }

    const navLinks = document.querySelectorAll('nav a.nav-button, .dropdown-content a');
    navLinks.forEach(link => {
      const page = pageFromHref(link.getAttribute('href'));
      if (!page) {
        return;
      }
      const readOnly = isReadOnlyPage(role, page);
      if (!isPageAllowedForRole(role, page)) {
        if (readOnly) {
          link.style.display = '';
          applyReadOnlyState(link);
        } else {
          link.style.display = 'none';
          clearReadOnlyState(link);
        }
      } else {
        link.style.display = '';
        clearReadOnlyState(link);
      }
    });

    const dropdowns = document.querySelectorAll('.nav-dropdown');
    dropdowns.forEach(dropdown => {
      const childLinks = dropdown.querySelectorAll('.dropdown-content a');
      const hasVisibleChild = Array.from(childLinks).some(a => a.style.display !== 'none');
      const toggleButton = dropdown.querySelector('button');
      if (role === 'admin') {
        if (toggleButton) {
          toggleButton.style.display = '';
        }
        dropdown.style.display = '';
        return;
      }
      if (!hasVisibleChild) {
        if (toggleButton) {
          toggleButton.style.display = 'none';
        }
        dropdown.style.display = 'none';
      } else {
        if (toggleButton) {
          toggleButton.style.display = '';
        }
        dropdown.style.display = '';
      }
    });
  }

  function clearAuthState() {
    const KEYS = [
      'app_user_role',
      'app_logged_in',
      'app_user_name',
      'app_user_id',
      'app_access_token',
      'app_token_type',
      'app_token_expires_in',
      'sbp_loginrole',
      'superuser',
      'nurseipd',
      'nurseopd',
      'nurseopd9'
    ];
    KEYS.forEach(function(key) {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn('Unable to remove key from sessionStorage during logout:', key, error);
      }
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('Unable to remove key from localStorage during logout:', key, error);
      }
    });
  }

  function logout(options) {
    clearAuthState();
    window.dispatchEvent(new Event('sbp:role-changed'));
    const hasRedirect = options && Object.prototype.hasOwnProperty.call(options, 'redirectTo');
    const redirectTarget = hasRedirect ? options.redirectTo : 'login.html';
    if (redirectTarget) {
      try {
        window.location.replace(redirectTarget);
      } catch (error) {
        window.location.href = redirectTarget;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', enforceNavVisibility);
  window.addEventListener('sbp:role-changed', enforceNavVisibility);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    enforceNavVisibility();
  }

  window.sbpAccessControl = {
    getUserRole,
    applyNavRules: enforceNavVisibility,
    getAllowedPages,
    isPageAllowed(page) {
      const role = getUserRole();
      return isPageAllowedForRole(role, page);
    },
    logout
  };
})();