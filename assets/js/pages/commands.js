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

        var enchant = value("enchant");
        if (enchant) {
            if (hasNoPlayer) {
                notes.push("Enchantments are refused on lightning and periodic: there is no held item.");
            } else {
                var level = Math.max(0, Math.min(255, parseInt(value("level"), 10) || 0));
                parts.push("enchant [{id:\"" + enchant + "\",lvl:" + level + "}]");
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

    tool.addEventListener("input", build);
    tool.addEventListener("change", function (event) {
        if (event.target === field("kind")) {
            field("target").value = value("kind") === "entity" ? "minecraft:zombie" : "minecraft:stone";
        }
        build();
    });
    build();
})();
