/*
 * Navegação client-side para URLs "limpas" (sem #) numa landing page de
 * rolagem única, hospedada como GitHub Pages estático puro.
 *
 * Como funciona (sem backend, sem build step):
 * 1. Clique num link interno (#secao): intercepta, rola até a seção e troca
 *    a URL visível para /secao via history.pushState — sem reload.
 * 2. Voltar/avançar do navegador: popstate rola até a seção correspondente
 *    à URL atual (pushState não dispara scroll sozinho).
 * 3. Acesso direto a /secao (deep link) ou refresh nela: como não existe
 *    pasta real /secao/ no repositório, o GitHub Pages serve 404.html.
 *    Esse arquivo guarda o path pedido em sessionStorage e redireciona
 *    para "/"; aqui, ao carregar, lemos esse valor, restauramos a URL
 *    limpa com history.replaceState e rolamos até a seção certa.
 *
 * Compatibilidade: links antigos com #secao continuam funcionando sozinhos
 * (o navegador rola nativamente ao carregar com hash), sem precisar de JS.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'spaRedirectPath';

  function sectionIdFromPath(pathname) {
    var clean = pathname.split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');
    if (clean === '' || clean.toLowerCase() === 'index.html') {
      return null; // home: sem seção específica, topo da página
    }
    return clean;
  }

  function pathForSectionId(id) {
    if (!id || id === 'topo') return '/';
    return '/' + id;
  }

  function focusSection(el) {
    if (!el) return;
    var hadTabindex = el.hasAttribute('tabindex');
    if (!hadTabindex) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    if (!hadTabindex) {
      el.addEventListener(
        'blur',
        function onBlur() {
          el.removeAttribute('tabindex');
          el.removeEventListener('blur', onBlur);
        },
        { once: true }
      );
    }
  }

  function scrollToSection(id, opts) {
    opts = opts || {};
    var el = id ? document.getElementById(id) : document.querySelector('.hero');
    if (!el) return false;

    el.scrollIntoView({
      behavior: opts.smooth === false ? 'auto' : 'smooth',
      block: 'start',
    });

    if (opts.focus !== false) {
      // Espera o scroll começar antes de mover o foco, pra não causar
      // um segundo salto visual quando o navegador focar o elemento.
      window.setTimeout(
        function () {
          focusSection(el);
        },
        opts.smooth === false ? 0 : 400
      );
    }
    return true;
  }

  // -------- 1. Clique nos links internos --------
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;

    var id = link.getAttribute('href').slice(1);
    if (!id) return;

    var target = document.getElementById(id);
    if (!target) return; // sem seção correspondente: deixa o padrão do navegador agir

    e.preventDefault();

    var path = pathForSectionId(id);
    if (location.pathname !== path) {
      history.pushState({ sectionId: id }, '', path);
    }
    scrollToSection(id);

    // Fecha o menu mobile (checkbox hack), se estiver aberto.
    var menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) menuToggle.checked = false;
  });

  // -------- 2. Botão voltar/avançar do navegador --------
  window.addEventListener('popstate', function () {
    var id = sectionIdFromPath(location.pathname);
    scrollToSection(id, { focus: false });
  });

  // -------- 3. Restaura deep link vindo do fallback de 404.html --------
  (function restoreDeepLink() {
    var redirectPath = null;
    try {
      redirectPath = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      // sessionStorage indisponível (ex.: navegação privada restrita): ignora.
    }

    // Também cobre o caso raro de o próprio servidor já entregar index.html
    // diretamente num path "limpo" (ex.: servidor local com history fallback).
    var path = redirectPath || location.pathname;
    var id = sectionIdFromPath(path);
    if (!id) return;

    var el = document.getElementById(id);
    if (!el) return;

    history.replaceState({ sectionId: id }, '', pathForSectionId(id));

    function doScroll() {
      // Dois rAF garantem que o layout já assentou (fontes/imagens acima
      // da seção-alvo carregadas) antes de calcular a posição de scroll.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          scrollToSection(id, { smooth: false });
        });
      });
    }

    if (document.readyState === 'complete') {
      doScroll();
    } else {
      window.addEventListener('load', doScroll, { once: true });
    }
  })();
})();
