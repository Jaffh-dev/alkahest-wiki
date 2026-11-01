/*
 * Mod landing page (mods/<id>/index.html): version selector, version facts and highlights, and the links of the
 * audience cards. Works for any mod: it reads data-mod from <html>. The chosen version is kept in "?v=<version>".
 */
(function () {
    "use strict";

    var Alkahest = window.Alkahest;
    var site = Alkahest.site;
    var el = site.el;
    var mod = Alkahest.findMod(site.context().modId);
    if (!mod) return;

    function versionFromUrl() {
        var match = /[?&]v=([^&#]+)/.exec(window.location.search);
        var version = match ? Alkahest.findVersion(mod, decodeURIComponent(match[1])) : null;
        return version || Alkahest.latestVersion(mod);
    }

    function renderFacts(version) {
        var facts = document.querySelector("[data-version-facts]");
        if (!facts) return;
        facts.innerHTML = "";
        [
            ["Version", version.label],
            ["Minecraft", version.minecraft],
            ["Loader", version.loader],
            ["API", version.api],
            ["Status", version.status]
        ].forEach(function (fact) {
            if (!fact[1]) return;
            facts.appendChild(el("div", null, [el("dt", null, [fact[0]]), el("dd", null, [fact[1]])]));
        });
    }

    function renderHighlights(version) {
        var list = document.querySelector("[data-version-highlights]");
        if (!list) return;
        list.innerHTML = "";
        (version.highlights || []).forEach(function (text) {
            list.appendChild(el("li", null, [text]));
        });
    }

    function updateLinks(version) {
        var links = document.querySelectorAll("[data-section-link]");
        Array.prototype.forEach.call(links, function (link) {
            link.href = site.docUrl(mod, version.id, link.getAttribute("data-section-link"), "index");
        });
    }

    function show(version) {
        renderFacts(version);
        renderHighlights(version);
        updateLinks(version);
    }

    var linkHost = document.querySelector("[data-mod-links]");
    if (linkHost && mod.links) {
        mod.links.forEach(function (link) {
            linkHost.appendChild(el("a", { className: "button" + (link.primary ? "" : " button--ghost"), href: link.url }, [link.label]));
        });
    }

    var current = versionFromUrl();
    var picker = document.querySelector("[data-version-picker]");
    if (picker) {
        picker.appendChild(
            Alkahest.versions.buildSelect(mod, current.id, function (versionId) {
                var version = Alkahest.findVersion(mod, versionId);
                if (!version) return;
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, "", "?v=" + encodeURIComponent(version.id));
                }
                show(version);
            })
        );
    }
    show(current);
})();
