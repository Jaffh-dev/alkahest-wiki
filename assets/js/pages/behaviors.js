/*
 * Drop behaviors page: roll calculator (exact count distribution of fixed_rolls / chained_rolls) and scale
 * calculator (max_health, hardness, damage_taken). Both follow the mod's own algorithm.
 */
(function () {
    "use strict";

    var Alkahest = window.Alkahest;
    var el = Alkahest.site.el;
    Alkahest.docs.init();

    function readFields(tool) {
        var values = {};
        Array.prototype.forEach.call(tool.querySelectorAll("[data-field]"), function (field) {
            var name = field.getAttribute("data-field");
            values[name] = field.tagName === "SELECT" ? field.value : parseFloat(field.value);
        });
        return values;
    }

    function bindInputs(tool, update) {
        tool.addEventListener("input", update);
        tool.addEventListener("change", update);
        update();
    }

    function percent(p) {
        if (p > 0 && p < 0.0001) return "<0.01%";
        return (p * 100).toFixed(p * 100 >= 10 ? 1 : 2) + "%";
    }

    /* ---------- Roll calculator ---------- */

    /**
     * Returns { count: probability } for a roll behavior, as the mod rolls it: the count starts at min, each roll
     * that succeeds adds the increment, rolling stops once max is reached, and chained_rolls also stops at the
     * first failure. Keys ending in "!" are chains that already stopped.
     */
    function rollDistribution(type, min, max, rolls, chance, increment) {
        var dist = {};
        dist[String(min)] = 1;
        for (var i = 0; i < rolls; i++) {
            var next = {};
            Object.keys(dist).forEach(function (key) {
                var p = dist[key];
                var total = parseInt(key, 10);
                var isStopped = key.charAt(key.length - 1) === "!";
                if (isStopped || total >= max) {
                    add(next, key, p);
                    return;
                }
                add(next, String(Math.min(total + increment, max)), p * chance);
                add(next, type === "chained_rolls" ? total + "!" : String(total), p * (1 - chance));
            });
            dist = next;
        }
        var result = {};
        Object.keys(dist).forEach(function (key) {
            add(result, String(Math.min(parseInt(key, 10), max)), dist[key]);
        });
        return result;
    }

    function add(map, key, p) {
        map[key] = (map[key] || 0) + p;
    }

    function updateRolls(tool) {
        var v = readFields(tool);
        var result = tool.querySelector("[data-roll-result]");
        var tableHost = tool.querySelector("[data-roll-table]");
        tableHost.innerHTML = "";

        var min = Math.max(0, Math.floor(v.min || 0));
        var max = Math.max(0, Math.floor(v.max || 0));
        var rolls = Math.max(0, Math.min(64, Math.floor(v.rolls || 0)));
        var chance = Math.max(0, Math.min(1, isNaN(v.chance) ? 0 : v.chance));
        var increment = Math.max(1, Math.floor(v.increment || 1));
        if (min > max) {
            result.textContent = "count.min is above count.max: the game reports this as an error.";
            return;
        }

        var dist = rollDistribution(v.type, min, max, rolls, chance, increment);
        var counts = Object.keys(dist)
            .map(Number)
            .sort(function (a, b) {
                return a - b;
            });
        var average = counts.reduce(function (sum, c) {
            return sum + c * dist[c];
        }, 0);

        result.innerHTML = "";
        result.appendChild(document.createTextNode("Average count when the drop happens: "));
        result.appendChild(el("strong", null, [average.toFixed(2)]));

        var body = el("tbody");
        counts.forEach(function (c) {
            body.appendChild(el("tr", null, [el("td", null, [String(c)]), el("td", null, [percent(dist[c])])]));
        });
        var table = el("table", null, [
            el("thead", null, [el("tr", null, [el("th", null, ["Count"]), el("th", null, ["Probability"])])]),
            body
        ]);
        tableHost.appendChild(el("div", { className: "table-wrap" }, [table]));
    }

    /* ---------- Scale calculator ---------- */

    function updateScale(tool) {
        var v = readFields(tool);
        var result = tool.querySelector("[data-scale-result]");
        var min = Math.max(0, Math.floor(v.min || 0));
        var max = Math.max(0, Math.floor(v.max || 0));
        result.innerHTML = "";

        if (!(v.multiplier > 0) || !(v.divisor > 0)) {
            result.textContent = "multiplier and divisor must be above 0: the game reports this as an error.";
            return;
        }
        if (min > max) {
            result.textContent = "count.min is above count.max: the game reports this as an error.";
            return;
        }

        var count;
        var detail;
        if (!(v.value > 0)) {
            count = min;
            detail = "value is 0 or less, so the count is count.min (damage_taken drops nothing instead)";
        } else {
            var x = v.value / v.divisor;
            var raw = v.multiplier * (v["function"] === "log" ? Math.log(x) : x);
            count = Math.max(min, Math.min(Math.round(raw), max));
            detail =
                v.multiplier + " × " + (v["function"] === "log" ? "ln" : "") + "(" + v.value + " / " + v.divisor +
                ") = " + raw.toFixed(3) + ", rounded and clamped to " + min + "–" + max;
        }
        result.appendChild(document.createTextNode("Count: "));
        result.appendChild(el("strong", null, [String(count)]));
        result.appendChild(el("span", { className: "muted" }, [" (" + detail + ")"]));
    }

    var rollTool = document.querySelector("[data-roll-tool]");
    if (rollTool) {
        bindInputs(rollTool, function () {
            updateRolls(rollTool);
        });
    }
    var scaleTool = document.querySelector("[data-scale-tool]");
    if (scaleTool) {
        bindInputs(scaleTool, function () {
            updateScale(scaleTool);
        });
    }
})();
