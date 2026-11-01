/*
 * Shared page shell: header, footer, theme button, code highlighting and copy buttons.
 * Every page loads it. A page describes itself with data attributes on <html>:
 *   data-root     relative path to the site root ("" on the home page, "../../" in mods/<id>/...)
 *   data-mod      mod id from assets/js/data/mods.js (mod pages only)
 *   data-version  version id (versioned doc pages only)
 *   data-section  "datapacks" or "developers" (doc pages only)
 *   data-page     page id inside its section, the file name without ".html"
 */
(function () {
    "use strict";

    var Alkahest = (window.Alkahest = window.Alkahest || {});
    var html = document.documentElement;

    var ICONS = {
        sun:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
            'aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 ' +
            '1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
        moon:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
            'stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
        github:
            '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.6 ' +
            "22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 " +
            "1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 " +
            "0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 " +
            "4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z\"/></svg>",
        menu:
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
            'aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
    };

    /** Reads the data attributes that describe the current page. */
    function context() {
        return {
            root: html.getAttribute("data-root") || "",
            modId: html.getAttribute("data-mod"),
            versionId: html.getAttribute("data-version"),
            section: html.getAttribute("data-section"),
            page: html.getAttribute("data-page")
        };
    }

    /** Resolves a path from the site root against the current page. */
    function url(path) {
        return context().root + path;
    }

    /** Creates an element with attributes and children (strings become text). */
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            Object.keys(attrs).forEach(function (key) {
                var value = attrs[key];
                if (value === null || value === undefined || value === false) return;
                if (key === "className") node.className = value;
                else if (key === "html") node.innerHTML = value;
                else if (key.indexOf("on") === 0 && typeof value === "function") {
                    node.addEventListener(key.substring(2), value);
                } else node.setAttribute(key, value === true ? "" : value);
            });
        }
        (children || []).forEach(function (child) {
            if (child === null || child === undefined) return;
            node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
        });
        return node;
    }

    /** Builds the link of a doc page of a mod version. */
    function docUrl(mod, versionId, section, page) {
        return url(mod.path + versionId + "/" + section + "/" + (page || "index") + ".html");
    }

    function sectionTitle(mod, sectionId) {
        for (var i = 0; i < mod.sections.length; i++) {
            if (mod.sections[i].id === sectionId) return mod.sections[i].title;
        }
        return sectionId;
    }

    /* ---------- Header ---------- */

    function buildCrumbs(ctx) {
        var mod = ctx.modId ? Alkahest.findMod(ctx.modId) : null;
        if (!mod) return null;
        var crumbs = el("nav", { className: "site-crumbs", "aria-label": "Breadcrumb" });
        var sep = function () {
            return el("span", { className: "site-crumbs__sep", "aria-hidden": "true" }, ["/"]);
        };
        if (!ctx.section) {
            crumbs.appendChild(sep());
            crumbs.appendChild(el("span", { className: "site-crumbs__current" }, [mod.name]));
            return crumbs;
        }
        crumbs.appendChild(sep());
        crumbs.appendChild(el("a", { href: url(mod.path + "index.html") }, [mod.name]));
        crumbs.appendChild(sep());
        crumbs.appendChild(el("span", { className: "site-crumbs__current" }, [sectionTitle(mod, ctx.section)]));
        return crumbs;
    }

    function buildThemeButton() {
        var button = el("button", {
            type: "button",
            className: "icon-button theme-toggle",
            title: "Switch light / dark theme",
            "aria-label": "Switch light / dark theme",
            html:
                '<span class="theme-toggle__light">' + ICONS.sun + "</span>" +
                '<span class="theme-toggle__dark">' + ICONS.moon + "</span>"
        });
        button.addEventListener("click", function () {
            Alkahest.theme.toggle();
        });
        return button;
    }

    function renderHeader() {
        var header = document.querySelector("[data-site-header]");
        if (!header) return;
        var ctx = context();
        var mod = ctx.modId ? Alkahest.findMod(ctx.modId) : null;

        var actions = el("div", { className: "site-header__actions" });
        if (ctx.section) {
            actions.appendChild(
                el("button", {
                    type: "button",
                    className: "icon-button menu-toggle",
                    "aria-label": "Open the page list",
                    "aria-controls": "docs-sidebar",
                    "aria-expanded": "false",
                    "data-menu-toggle": true,
                    html: ICONS.menu
                })
            );
        }
        if (mod && mod.repository) {
            actions.appendChild(
                el("a", {
                    className: "icon-button",
                    href: mod.repository,
                    title: mod.name + " on GitHub",
                    "aria-label": mod.name + " on GitHub",
                    html: ICONS.github
                })
            );
        }
        actions.appendChild(buildThemeButton());

        var inner = el("div", { className: "site-header__inner" }, [
            el("a", { className: "site-brand", href: url("index.html") }, [
                el("img", { src: url("assets/img/logo.svg"), alt: "", width: "28", height: "28" }),
                el("span", null, ["Alkahest Wiki"])
            ]),
            buildCrumbs(ctx),
            actions
        ]);
        header.appendChild(inner);
    }

    /* ---------- Footer ---------- */

    function renderFooter() {
        var footer = document.querySelector("[data-site-footer]");
        if (!footer) return;
        footer.appendChild(
            el("div", { className: "site-footer__inner" }, [
                el("span", null, ["Alkahest Wiki: documentation for the Alkahest family of Minecraft mods."]),
                el("span", null, ["Not affiliated with Mojang or Microsoft."])
            ])
        );
    }

    /* ---------- Code blocks ---------- */

    function escapeHtml(text) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /**
     * Highlights text with a list of [class, regex source] rules tried in order; the first group that matches wins.
     * A rule class of "json-string" marks a string followed by ":" as a key.
     */
    function highlight(text, rules) {
        var source = rules
            .map(function (rule) {
                return "(" + rule[1] + ")";
            })
            .join("|");
        var regex = new RegExp(source, "gm");
        var out = "";
        var last = 0;
        var match;
        while ((match = regex.exec(text)) !== null) {
            if (match[0] === "") {
                regex.lastIndex++;
                continue;
            }
            out += escapeHtml(text.substring(last, match.index));
            var cls = null;
            for (var i = 0; i < rules.length; i++) {
                if (match[i + 1] !== undefined) {
                    cls = rules[i][0];
                    break;
                }
            }
            if (cls === "json-string") {
                var rest = text.substring(regex.lastIndex);
                cls = /^\s*:/.test(rest) ? "key" : "string";
            }
            out += '<span class="tok-' + cls + '">' + escapeHtml(match[0]) + "</span>";
            last = regex.lastIndex;
        }
        return out + escapeHtml(text.substring(last));
    }

    var JAVA_KEYWORDS =
        "\\b(?:public|private|protected|static|final|class|interface|record|enum|extends|implements|import|" +
        "package|return|if|else|for|while|new|void|boolean|int|double|float|long|var|null|true|false|this|" +
        "throws|try|catch|sealed|permits|instanceof|switch|case|default)\\b";

    var LANGUAGES = {
        json: [
            ["comment", "\\/\\/.*$"],
            ["json-string", '"(?:\\\\.|[^"\\\\])*"'],
            ["number", "-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b"],
            ["keyword", "\\b(?:true|false|null)\\b"]
        ],
        java: [
            ["comment", "\\/\\/.*$|\\/\\*[\\s\\S]*?\\*\\/"],
            ["string", '"(?:\\\\.|[^"\\\\])*"'],
            ["key", "@[A-Za-z]+"],
            ["keyword", JAVA_KEYWORDS],
            ["number", "\\b\\d+(?:\\.\\d+)?\\b"]
        ],
        gradle: [
            ["comment", "\\/\\/.*$"],
            ["string", "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'"],
            ["keyword", "\\b(?:repositories|dependencies|maven|flatDir|compileOnly|runtimeOnly|implementation|dir|url)\\b"]
        ],
        toml: [
            ["comment", "#.*$"],
            ["string", '"(?:\\\\.|[^"\\\\])*"'],
            ["key", "^\\s*[A-Za-z0-9_.-]+(?=\\s*=)|^\\s*\\[\\[?[^\\]]+\\]\\]?"],
            ["number", "\\b\\d+(?:\\.\\d+)?\\b"],
            ["keyword", "\\b(?:true|false)\\b"]
        ],
        mcfunction: [
            ["comment", "^\\s*#.*$"],
            ["keyword", "^\\s*[a-z]+(?=\\s|$)"],
            ["string", '"(?:\\\\.|[^"\\\\])*"'],
            ["key", "@[apresn](?:\\[[^\\]]*\\])?"],
            ["number", "(?:~|\\^)?-?\\b\\d+(?:\\.\\d+)?\\b"]
        ],
        command: [
            ["keyword", "^\\/[a-z]+"],
            ["string", '"(?:\\\\.|[^"\\\\])*"'],
            ["key", "@[apresn](?:\\[[^\\]]*\\])?"],
            ["number", "\\b\\d+\\b"]
        ]
    };

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        return new Promise(function (resolve, reject) {
            var area = el("textarea", { readonly: true, className: "visually-hidden" });
            area.value = text;
            document.body.appendChild(area);
            area.select();
            try {
                document.execCommand("copy") ? resolve() : reject(new Error("copy refused"));
            } catch (e) {
                reject(e);
            } finally {
                document.body.removeChild(area);
            }
        });
    }

    function addCopyButton(wrapper, code) {
        var button = el("button", { type: "button", className: "copy-button" }, ["Copy"]);
        button.addEventListener("click", function () {
            copyText(code.textContent).then(
                function () {
                    button.textContent = "Copied";
                    button.classList.add("is-done");
                    setTimeout(function () {
                        button.textContent = "Copy";
                        button.classList.remove("is-done");
                    }, 1600);
                },
                function () {
                    button.textContent = "Press Ctrl+C";
                }
            );
        });
        wrapper.appendChild(button);
    }

    /** Highlights one <code data-lang="..."> element from its text; call again after changing its text. */
    function highlightCode(code) {
        var lang = code.getAttribute("data-lang");
        if (lang && LANGUAGES[lang]) code.innerHTML = highlight(code.textContent, LANGUAGES[lang]);
    }

    /** Highlights every <pre><code data-lang="..."> and adds a label (pre[data-title]) and a copy button. */
    function enhanceCodeBlocks(scope) {
        var blocks = (scope || document).querySelectorAll("pre > code");
        Array.prototype.forEach.call(blocks, function (code) {
            var pre = code.parentNode;
            if (pre.parentNode.classList.contains("code-block")) return;
            highlightCode(code);

            var wrapper = el("div", { className: "code-block" });
            pre.parentNode.insertBefore(wrapper, pre);
            var title = pre.getAttribute("data-title");
            if (title) wrapper.appendChild(el("span", { className: "code-block__label" }, [title]));
            wrapper.appendChild(pre);
            addCopyButton(wrapper, code);
        });
    }

    /** Wraps every table of the scope so wide tables scroll instead of widening the page. */
    function wrapTables(scope) {
        var tables = (scope || document).querySelectorAll("table");
        Array.prototype.forEach.call(tables, function (table) {
            if (table.parentNode.classList.contains("table-wrap")) return;
            var wrap = el("div", { className: "table-wrap" });
            table.parentNode.insertBefore(wrap, table);
            wrap.appendChild(table);
        });
    }

    Alkahest.site = {
        context: context,
        url: url,
        el: el,
        docUrl: docUrl,
        sectionTitle: sectionTitle,
        enhanceCodeBlocks: enhanceCodeBlocks,
        highlightCode: highlightCode
    };

    renderHeader();
    renderFooter();
    wrapTables(document);
    enhanceCodeBlocks(document);
})();
