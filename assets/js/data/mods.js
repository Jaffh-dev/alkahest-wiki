/*
 * Registry of the Alkahest mods shown on the site. The home page builds one card per entry, and every page of a mod
 * reads its versions and sections from here.
 *
 * To add a mod: add an entry below, create mods/<id>/index.html (copy mods/alkahest-drops/index.html) and one
 * folder per version with its nav.js and pages. See README.md.
 * To add a version: add it to "versions" (newest first, set "latest" on one), copy the previous version's folder
 * and edit what changed.
 */
(function () {
    "use strict";

    window.Alkahest = window.Alkahest || {};

    window.Alkahest.mods = [
        {
            id: "alkahest-drops",
            name: "Alkahest Drops",
            tagline: "Data-driven mob and block drops",
            description:
                "Add, remove and tune mob and block drops with JSON files: chances, rolls, enchantment bonuses, " +
                "bad-luck protection, one-time and per-player drops, triggers beyond death and actions when a drop " +
                "lands. Checked on load, simulated in game, shown in JEI.",
            icon: "assets/img/mods/alkahest-drops.svg",
            path: "mods/alkahest-drops/",
            status: "Released",
            loader: "Forge",
            minecraft: ["1.20.1"],
            tags: ["Library", "Datapacks", "Server side"],
            repository: "https://github.com/Jaffh-dev/alkahest-drops",
            links: [
                { label: "Modrinth", url: "https://modrinth.com/mod/alkahest-drops", primary: true },
                { label: "CurseForge", url: "https://www.curseforge.com/minecraft/mc-mods/alkahest-drops" },
                { label: "Source code", url: "https://github.com/Jaffh-dev/alkahest-drops" },
                { label: "Report an issue", url: "https://github.com/Jaffh-dev/alkahest-drops/issues" },
                { label: "Changelog", url: "https://github.com/Jaffh-dev/alkahest-drops/blob/main/CHANGELOG.md" }
            ],
            sections: [
                {
                    id: "datapacks",
                    title: "Datapack creators",
                    shortTitle: "Datapacks",
                    summary: "Write drop and removal files, use triggers and bonuses, test them with commands."
                },
                {
                    id: "developers",
                    title: "Mod developers",
                    shortTitle: "Developers",
                    summary: "Ship drop files in your mod, listen to drop events, read drops and player progress."
                }
            ],
            versions: [
                {
                    id: "1.20.1-1.0.0",
                    label: "1.0.0",
                    minecraft: "1.20.1",
                    loader: "Forge 47.4+",
                    api: "1.0.0",
                    status: "Released",
                    latest: true,
                    highlights: [
                        "First release: drop files and removal files, file format 1",
                        "Triggers beyond death: shear, hit, lightning, periodic",
                        "Bad-luck protection, one-time and per-player drops",
                        "on_drop actions: glow and datapack functions",
                        "/alkdrops commands and JEI pages",
                        "API 1.0.0: read API, progress API, OnDropEvent, DropFilesLoadedEvent"
                    ]
                }
            ]
        }
    ];

    /** Finds a mod by id, or null. */
    window.Alkahest.findMod = function (id) {
        var mods = window.Alkahest.mods;
        for (var i = 0; i < mods.length; i++) {
            if (mods[i].id === id) return mods[i];
        }
        return null;
    };

    /** Returns the version marked "latest", else the first one. */
    window.Alkahest.latestVersion = function (mod) {
        for (var i = 0; i < mod.versions.length; i++) {
            if (mod.versions[i].latest) return mod.versions[i];
        }
        return mod.versions[0];
    };

    /** Finds a version of a mod by id, or null. */
    window.Alkahest.findVersion = function (mod, id) {
        for (var i = 0; i < mod.versions.length; i++) {
            if (mod.versions[i].id === id) return mod.versions[i];
        }
        return null;
    };

    /** Doc pages register their version's sidebar here (see mods/<id>/<version>/nav.js). */
    window.Alkahest.navs = window.Alkahest.navs || {};
    window.Alkahest.registerNav = function (modId, versionId, nav) {
        window.Alkahest.navs[modId + "@" + versionId] = nav;
    };
})();
