/*
 * Version selector shared by a mod's landing page and its doc pages.
 * Versions come from assets/js/data/mods.js; each version folder has its own nav.js listing its pages.
 */
(function () {
    "use strict";

    var Alkahest = (window.Alkahest = window.Alkahest || {});

    function versionLabel(version) {
        var text = version.label + " · Minecraft " + version.minecraft;
        if (version.latest) text += " (latest)";
        return text;
    }

    /**
     * Builds a labelled <select> of a mod's versions.
     * onChange receives the chosen version id.
     */
    function buildSelect(mod, currentId, onChange) {
        var el = Alkahest.site.el;
        var id = "version-select-" + Math.random().toString(36).slice(2, 8);
        var select = el("select", { id: id });
        mod.versions.forEach(function (version) {
            var option = el("option", { value: version.id }, [versionLabel(version)]);
            if (version.id === currentId) option.selected = true;
            select.appendChild(option);
        });
        select.addEventListener("change", function () {
            onChange(select.value);
        });
        return el("label", { className: "version-select", for: id }, [el("span", null, ["Version"]), select]);
    }

    function hasPage(nav, section, page) {
        var groups = nav && nav[section];
        if (!groups) return false;
        return groups.some(function (group) {
            return group.pages.some(function (entry) {
                return entry.id === page;
            });
        });
    }

    /**
     * Opens the same page in another version. The target version's nav.js is loaded first, so a page that does
     * not exist there falls back to the section's first page.
     */
    function openInVersion(mod, versionId, section, page) {
        var site = Alkahest.site;
        var key = mod.id + "@" + versionId;
        var go = function () {
            var nav = Alkahest.navs[key];
            var target = hasPage(nav, section, page) ? page : "index";
            window.location.href = site.docUrl(mod, versionId, section, target);
        };
        if (Alkahest.navs[key]) {
            go();
            return;
        }
        var script = document.createElement("script");
        script.src = site.url(mod.path + versionId + "/nav.js");
        script.onload = go;
        script.onerror = go;
        document.head.appendChild(script);
    }

    Alkahest.versions = {
        buildSelect: buildSelect,
        openInVersion: openInVersion,
        hasPage: hasPage
    };
})();
