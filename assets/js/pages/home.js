/* Home page: one card per mod of assets/js/data/mods.js. */
(function () {
    "use strict";

    var Alkahest = window.Alkahest;
    var site = Alkahest.site;
    var el = site.el;

    function buildCard(mod) {
        var latest = Alkahest.latestVersion(mod);
        var meta = el("div", { className: "mod-card__meta" }, [
            el("span", { className: "badge badge--accent" }, [mod.status]),
            el("span", { className: "badge" }, [mod.loader + " · " + mod.minecraft.join(", ")])
        ]);
        mod.tags.forEach(function (tag) {
            meta.appendChild(el("span", { className: "badge" }, [tag]));
        });

        var actions = el("div", { className: "mod-card__actions" });
        mod.sections.forEach(function (section, i) {
            actions.appendChild(
                el(
                    "a",
                    {
                        className: "button" + (i === 0 ? "" : " button--ghost"),
                        href: site.docUrl(mod, latest.id, section.id, "index")
                    },
                    [section.title]
                )
            );
        });

        return el("article", { className: "mod-card" }, [
            el("div", { className: "mod-card__head" }, [
                el("img", { className: "mod-card__icon", src: site.url(mod.icon), alt: "", width: "56", height: "56" }),
                el("div", null, [
                    el("h3", { className: "mod-card__name" }, [el("a", { href: site.url(mod.path + "index.html") }, [mod.name])]),
                    el("p", { className: "mod-card__tagline" }, [mod.tagline])
                ])
            ]),
            el("p", { className: "mod-card__description" }, [mod.description]),
            meta,
            actions
        ]);
    }

    var grid = document.querySelector("[data-mod-grid]");
    if (!grid) return;
    Alkahest.mods.forEach(function (mod) {
        grid.appendChild(buildCard(mod));
    });
    grid.appendChild(
        el("div", { className: "mod-card mod-card--placeholder" }, [
            el("p", null, ["More Alkahest mods are on the way :)"])
        ])
    );
})();
