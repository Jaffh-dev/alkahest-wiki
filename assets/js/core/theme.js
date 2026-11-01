/*
 * Theme (light / dark). Loaded in <head> without defer so the saved theme is set before the page paints.
 * The choice is kept in localStorage; without one, the system setting is followed.
 */
(function () {
    "use strict";

    var STORAGE_KEY = "alkahest-theme";
    var root = document.documentElement;
    var systemDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function readSaved() {
        try {
            var value = localStorage.getItem(STORAGE_KEY);
            return value === "light" || value === "dark" ? value : null;
        } catch (e) {
            return null;
        }
    }

    function save(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            /* storage blocked: the theme still applies for this page */
        }
    }

    function systemTheme() {
        return systemDark && systemDark.matches ? "dark" : "light";
    }

    function apply(theme) {
        root.setAttribute("data-theme", theme);
    }

    function current() {
        return root.getAttribute("data-theme") || systemTheme();
    }

    function toggle() {
        var next = current() === "dark" ? "light" : "dark";
        save(next);
        apply(next);
        return next;
    }

    apply(readSaved() || systemTheme());

    if (systemDark) {
        var onSystemChange = function () {
            if (!readSaved()) apply(systemTheme());
        };
        if (systemDark.addEventListener) systemDark.addEventListener("change", onSystemChange);
        else if (systemDark.addListener) systemDark.addListener(onSystemChange);
    }

    window.Alkahest = window.Alkahest || {};
    window.Alkahest.theme = { current: current, toggle: toggle };
})();
