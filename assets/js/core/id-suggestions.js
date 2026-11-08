/*
 * Autocomplete lists of vanilla ids (<datalist> elements) shared by the generator pages.
 * Reads assets/js/data/minecraft-1.20.1-ids.js, which must load first. Lists are built on first use.
 */
(function () {
    "use strict";

    var Alkahest = (window.Alkahest = window.Alkahest || {});

    /** Adds "minecraft:" to ids stored without a namespace ("#logs" becomes "#minecraft:logs"). */
    function expandId(id) {
        if (id === "*" || /:\*$/.test(id)) return id;
        if (id.charAt(0) === "#") return id.indexOf(":") === -1 ? "#minecraft:" + id.slice(1) : id;
        return id.indexOf(":") === -1 ? "minecraft:" + id : id;
    }

    /** List name → values, read from the id data of a Minecraft version. */
    function listValues(name, ids) {
        switch (name) {
            case "items":
                return ids.items;
            case "removal-items":
                return ["*"].concat(ids.items || [], ids.itemTags || []);
            case "only":
                return ["experience"].concat(ids.items || [], ids.itemTags || []);
            case "mobs":
                return ["*", "minecraft:*"].concat(ids.mobs || [], ids.entityTags || []);
            case "blocks":
                return ["*", "minecraft:*"].concat(ids.blocks || [], ids.blockTags || []);
            case "mob-ids":
                return ids.mobs;
            case "block-ids":
                return ids.blocks;
            case "enchantments":
                return ids.enchantments;
            default:
                return null;
        }
    }

    /**
     * Makes sure the <datalist> of a list exists and returns its element id, for an input's "list" attribute.
     * Returns null when the id data is missing or the list name is unknown.
     */
    function listId(name, version) {
        var ids = Alkahest.ids && Alkahest.ids[version || "1.20.1"];
        if (!ids) return null;
        var id = "ids-" + name;
        if (document.getElementById(id)) return id;
        var values = listValues(name, ids);
        if (!values) return null;
        var list = document.createElement("datalist");
        list.id = id;
        values.forEach(function (value) {
            var option = document.createElement("option");
            option.value = value === "experience" ? value : expandId(value);
            list.appendChild(option);
        });
        document.body.appendChild(list);
        return id;
    }

    /** Points an input at a list (or removes its list when the name is null). */
    function attach(input, name, version) {
        var id = name ? listId(name, version) : null;
        if (id) input.setAttribute("list", id);
        else input.removeAttribute("list");
    }

    Alkahest.idSuggestions = { expandId: expandId, listId: listId, attach: attach };
})();
