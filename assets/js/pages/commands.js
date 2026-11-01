/*
 * Commands page: builds an /alkdrops simulate command from a form, keeping the option order the command requires
 * and refusing the combinations the command refuses.
 */
(function () {
    "use strict";

    var Alkahest = window.Alkahest;
    Alkahest.docs.init();

    var tool = document.querySelector("[data-simulate-tool]");
    if (!tool) return;
    var output = tool.querySelector("[data-simulate-output]");
    var note = tool.querySelector("[data-simulate-note]");

    function field(name) {
        return tool.querySelector('[data-field="' + name + '"]');
    }

    var enchantList = tool.querySelector("[data-enchant-list]");

    /** Adds one enchantment row: id, level and a remove button. */
    function addEnchantRow(id, level) {
        var el = Alkahest.site.el;
        var row = el("div", { className: "tool__row" }, [
            el("label", null, ["Enchantment id", el("input", { type: "text", "data-enchant-id": true, value: id || "", placeholder: "minecraft:looting", spellcheck: "false" })]),
            el("label", null, ["Level", el("input", { type: "number", "data-enchant-level": true, value: String(level === undefined ? 3 : level), min: "0", max: "255", step: "1" })]),
            el("button", { type: "button", className: "button button--ghost tool__remove", "data-remove-enchant": true, "aria-label": "Remove this enchantment" }, ["Remove"])
        ]);
        enchantList.appendChild(row);
        return row;
    }

    /** Returns the filled enchantment rows, in order. */
    function readEnchantments() {
        var list = [];
        Array.prototype.forEach.call(enchantList.querySelectorAll(".tool__row"), function (row) {
            var id = row.querySelector("[data-enchant-id]").value.trim();
            if (!id) return;
            var level = Math.max(0, Math.min(255, parseInt(row.querySelector("[data-enchant-level]").value, 10) || 0));
            list.push({ id: id, level: level });
        });
        return list;
    }

    function value(name) {
        return field(name).value.trim();
    }

    /** Shows only the fields and options that apply to the chosen target kind and actor. */
    function updateVisibility(kind, by) {
        Array.prototype.forEach.call(tool.querySelectorAll("[data-only]"), function (node) {
            var isShown = node.getAttribute("data-only") === kind;
            if (node.tagName === "OPTION") node.disabled = !isShown;
            node.hidden = !isShown;
        });
        Array.prototype.forEach.call(tool.querySelectorAll("[data-only-by]"), function (node) {
            node.hidden = node.getAttribute("data-only-by") !== by;
        });
        var bySelect = field("by");
        if (bySelect.selectedOptions && bySelect.selectedOptions[0] && bySelect.selectedOptions[0].disabled) {
            bySelect.value = "";
        }
    }

    function build() {
        var kind = value("kind");
        var by = value("by");
        updateVisibility(kind, by);
        by = value("by");

        var notes = [];
        var parts = ["/alkdrops simulate", kind, value("target") || (kind === "entity" ? "minecraft:zombie" : "minecraft:stone")];
        var trigger = kind === "entity" ? value("trigger") : "";
        var hasNoPlayer = trigger === "lightning" || trigger === "periodic";
        if (trigger) parts.push("on " + trigger);

        var runs = parseInt(value("runs"), 10);
        if (runs > 0) parts.push(String(Math.min(runs, 1000000)));

        var enchants = readEnchantments();
        if (enchants.length) {
            if (hasNoPlayer) {
                notes.push("Enchantments are refused on lightning and periodic: there is no held item.");
            } else {
                var seen = {};
                enchants.forEach(function (e) {
                    var id = e.id.indexOf(":") === -1 ? "minecraft:" + e.id : e.id;
                    if (seen[id]) notes.push(id + " is listed twice: the command refuses a repeated enchantment.");
                    seen[id] = true;
                });
                parts.push("enchant [" + enchants.map(function (e) {
                    return "{id:\"" + e.id + "\",lvl:" + e.level + "}";
                }).join(",") + "]");
            }
        }

        if (by === "killer") {
            if (trigger) notes.push("A mob killer only applies to death.");
            parts.push("by " + (value("killer") || "minecraft:wolf"));
        } else if (by) {
            if (hasNoPlayer && by === "player") notes.push("Lightning and periodic have no player: 'by' is refused.");
            else parts.push("by " + by);
        }
        if ((trigger === "shear" || trigger === "hit") && by === "none") {
            notes.push("Shear and hit need a player.");
        }

        if (value("sneaking")) {
            if (hasNoPlayer) notes.push("Sneaking is refused on lightning and periodic.");
            else if (by === "none" || by === "explosion") notes.push("Sneaking needs a player or a killer.");
            else parts.push("sneaking");
        }
        if (kind === "entity" && value("burning")) parts.push("burning");

        var only = value("only");
        if (only) parts.push("only " + only);
        if (value("drop")) parts.push(value("drop"));

        output.textContent = parts.join(" ");
        Alkahest.site.highlightCode(output);
        note.textContent = notes.join(" ");
    }

    tool.addEventListener("click", function (event) {
        if (event.target.closest("[data-add-enchant]")) {
            addEnchantRow("", 3).querySelector("input").focus();
            build();
        } else if (event.target.closest("[data-remove-enchant]")) {
            event.target.closest(".tool__row").remove();
            build();
        }
    });
    tool.addEventListener("input", build);
    tool.addEventListener("change", function (event) {
        if (event.target === field("kind")) {
            field("target").value = value("kind") === "entity" ? "minecraft:zombie" : "minecraft:stone";
        }
        build();
    });
    addEnchantRow("", 3);
    build();
})();
