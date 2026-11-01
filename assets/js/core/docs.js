/*
 * Doc page layout: sidebar (section tabs, version selector, page filter, page list), "On this page" list,
 * heading anchors, previous / next links and the mobile menu. The page list comes from the version's nav.js.
 */
(function () {
    "use strict";

    var Alkahest = window.Alkahest;
    var site = Alkahest.site;
    var el = site.el;

    function slug(text) {
        return text
            .toLowerCase()
            .replace(/[`'"]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function flatPages(groups) {
        var list = [];
        groups.forEach(function (group) {
            group.pages.forEach(function (page) {
                list.push(page);
            });
        });
        return list;
    }

    /* ---------- Sidebar ---------- */

    function buildSectionTabs(mod, ctx) {
        var tabs = el("div", { className: "section-tabs", role: "navigation", "aria-label": "Audience" });
        mod.sections.forEach(function (section) {
            var isCurrent = section.id === ctx.section;
            tabs.appendChild(
                el(
                    "a",
                    {
                        className: "section-tabs__tab" + (isCurrent ? " is-current" : ""),
                        href: site.docUrl(mod, ctx.versionId, section.id, "index"),
                        "aria-current": isCurrent ? "page" : null
                    },
                    [section.shortTitle || section.title]
                )
            );
        });
        return tabs;
    }

    function buildFilter(list) {
        var input = el("input", {
            type: "search",
            className: "nav-filter",
            placeholder: "Filter pages",
            "aria-label": "Filter pages"
        });
        input.addEventListener("input", function () {
            var query = input.value.trim().toLowerCase();
            Array.prototype.forEach.call(list.querySelectorAll(".nav-group"), function (group) {
                var visible = 0;
                Array.prototype.forEach.call(group.querySelectorAll("li"), function (item) {
                    var match = !query || item.getAttribute("data-search").indexOf(query) !== -1;
                    item.hidden = !match;
                    if (match) visible++;
                });
                group.hidden = visible === 0;
            });
        });
        return input;
    }

    function buildPageList(mod, ctx, groups) {
        var list = el("nav", { className: "nav-list", "aria-label": "Pages" });
        groups.forEach(function (group) {
            var items = el("ul");
            group.pages.forEach(function (page) {
                var isCurrent = page.id === ctx.page;
                var search = (page.title + " " + (page.keywords || "")).toLowerCase();
                items.appendChild(
                    el("li", { "data-search": search }, [
                        el(
                            "a",
                            {
                                href: site.docUrl(mod, ctx.versionId, ctx.section, page.id),
                                className: isCurrent ? "is-current" : null,
                                "aria-current": isCurrent ? "page" : null
                            },
                            [page.title]
                        )
                    ])
                );
            });
            list.appendChild(el("div", { className: "nav-group" }, [el("p", { className: "nav-group__title" }, [group.title]), items]));
        });
        return list;
    }

    function renderSidebar(mod, ctx, groups) {
        var sidebar = document.querySelector("[data-docs-sidebar]");
        if (!sidebar) return;
        var versionSelect = Alkahest.versions.buildSelect(mod, ctx.versionId, function (versionId) {
            Alkahest.versions.openInVersion(mod, versionId, ctx.section, ctx.page);
        });
        var list = buildPageList(mod, ctx, groups);
        sidebar.appendChild(
            el("div", { className: "docs-sidebar__inner" }, [
                el("a", { className: "docs-sidebar__mod", href: site.url(mod.path + "index.html") }, [
                    el("img", { src: site.url(mod.icon), alt: "", width: "32", height: "32" }),
                    el("span", null, [mod.name])
                ]),
                versionSelect,
                buildSectionTabs(mod, ctx),
                buildFilter(list),
                list
            ])
        );
        var current = sidebar.querySelector(".is-current[href]");
        if (current && current.scrollIntoView && sidebar.scrollHeight > sidebar.clientHeight) {
            current.scrollIntoView({ block: "center" });
            window.scrollTo(0, 0);
        }
    }

    /* ---------- Mobile menu ---------- */

    function setupMenu() {
        var toggle = document.querySelector("[data-menu-toggle]");
        var sidebar = document.querySelector("[data-docs-sidebar]");
        if (!toggle || !sidebar) return;
        var backdrop = el("div", { className: "docs-backdrop", "aria-hidden": "true" });
        document.body.appendChild(backdrop);

        var setOpen = function (isOpen) {
            sidebar.classList.toggle("is-open", isOpen);
            backdrop.classList.toggle("is-open", isOpen);
            document.body.classList.toggle("has-open-menu", isOpen);
            toggle.setAttribute("aria-expanded", String(isOpen));
        };
        toggle.addEventListener("click", function () {
            setOpen(!sidebar.classList.contains("is-open"));
        });
        backdrop.addEventListener("click", function () {
            setOpen(false);
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") setOpen(false);
        });
        sidebar.addEventListener("click", function (event) {
            if (event.target.closest("a")) setOpen(false);
        });
    }

    /* ---------- Headings, table of contents ---------- */

    function prepareHeadings(content) {
        var used = {};
        var headings = content.querySelectorAll("h2, h3");
        Array.prototype.forEach.call(headings, function (heading) {
            if (!heading.id) {
                var base = slug(heading.textContent) || "section";
                var id = base;
                var n = 2;
                while (used[id] || document.getElementById(id)) id = base + "-" + n++;
                heading.id = id;
            }
            used[heading.id] = true;
            heading.appendChild(
                el("a", { className: "heading-anchor", href: "#" + heading.id, "aria-label": "Link to this section" }, ["#"])
            );
        });
        return headings;
    }

    function renderToc(headings) {
        var toc = document.querySelector("[data-docs-toc]");
        if (!toc) return;
        var entries = Array.prototype.filter.call(headings, function (heading) {
            return heading.tagName === "H2";
        });
        if (entries.length < 2) {
            toc.hidden = true;
            return;
        }
        var list = el("ul");
        var links = {};
        entries.forEach(function (heading) {
            var text = heading.firstChild ? heading.textContent.replace(/#$/, "").trim() : "";
            var link = el("a", { href: "#" + heading.id }, [text]);
            links[heading.id] = link;
            list.appendChild(el("li", null, [link]));
        });
        toc.appendChild(el("div", { className: "docs-toc__inner" }, [el("p", { className: "docs-toc__title" }, ["On this page"]), list]));

        if (!("IntersectionObserver" in window)) return;
        var active = null;
        var observer = new IntersectionObserver(
            function (records) {
                records.forEach(function (record) {
                    if (!record.isIntersecting) return;
                    if (active) active.classList.remove("is-active");
                    active = links[record.target.id];
                    if (active) active.classList.add("is-active");
                });
            },
            { rootMargin: "-70px 0px -70% 0px" }
        );
        entries.forEach(function (heading) {
            observer.observe(heading);
        });
    }

    /* ---------- Pager ---------- */

    function renderPager(mod, ctx, groups) {
        var pager = document.querySelector("[data-docs-pager]");
        if (!pager) return;
        var pages = flatPages(groups);
        var index = -1;
        pages.forEach(function (page, i) {
            if (page.id === ctx.page) index = i;
        });
        if (index === -1) return;
        var link = function (page, label, className) {
            return el("a", { className: "docs-pager__link " + className, href: site.docUrl(mod, ctx.versionId, ctx.section, page.id) }, [
                el("span", { className: "docs-pager__label" }, [label]),
                el("span", { className: "docs-pager__title" }, [page.title])
            ]);
        };
        if (index > 0) pager.appendChild(link(pages[index - 1], "Previous", "docs-pager__link--prev"));
        if (index < pages.length - 1) pager.appendChild(link(pages[index + 1], "Next", "docs-pager__link--next"));
    }

    /* ---------- Start ---------- */

    function init() {
        var ctx = site.context();
        var mod = Alkahest.findMod(ctx.modId);
        if (!mod) return;
        var nav = Alkahest.navs[mod.id + "@" + ctx.versionId] || {};
        var groups = nav[ctx.section] || [];

        renderSidebar(mod, ctx, groups);
        setupMenu();
        var content = document.querySelector(".docs-content");
        if (content) renderToc(prepareHeadings(content));
        renderPager(mod, ctx, groups);

        if (window.location.hash) {
            var target = document.getElementById(decodeURIComponent(window.location.hash.substring(1)));
            if (target) target.scrollIntoView();
        }
    }

    Alkahest.docs = { init: init, slug: slug };
})();
