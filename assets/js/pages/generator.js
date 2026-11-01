/*
 * Drop file generator: a form that edits an Alkahest Drops file (format 1) directly, with a plain-English preview of
 * each drop, client-side checks, recipes, import, copy / download, datapack zip export, share links and simulate
 * commands. The state is the JSON file itself plus where it goes (mob or block, namespace, file name).
 */
(function () {
    "use strict";

    var A = window.Alkahest;
    var site = A.site;
    var el = site.el;
    A.docs.init();

    var root = document.querySelector("[data-generator]");
    if (!root) return;

    var IDS = (A.ids && A.ids["1.20.1"]) || {};
    var PACK_FORMAT = 15;
    var DEFAULT_LIMIT = 1024;
    var ID_RE = /^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/;
    var TARGET_RE = /^(?:\*|#(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+|[a-z0-9_.-]+:\*|(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+)$/;
    var REMOVAL_RE = /^(?:\*|#(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+|(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+)$/;
    var PROGRESS_ID_RE = /^[a-z0-9_./-]+$/;
    var NAME_RE = /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/;
    var TRIGGERS = ["death", "shear", "hit", "lightning", "periodic"];
    var ROLL_TYPES = ["fixed_rolls", "chained_rolls"];
    var SCALE_TYPES = ["max_health", "hardness", "damage_taken"];
    var BEHAVIORS = {
        mob: ["uniform", "fixed_rolls", "chained_rolls", "max_health", "damage_taken"],
        block: ["uniform", "fixed_rolls", "chained_rolls", "hardness"]
    };

    /* ======================================================================
     * Ids
     * ==================================================================== */

    function expandId(id) {
        if (id.charAt(0) === "#") return id.indexOf(":") === -1 ? "#minecraft:" + id.slice(1) : id;
        return id.indexOf(":") === -1 ? "minecraft:" + id : id;
    }

    function idSet(list) {
        var set = {};
        (list || []).forEach(function (id) {
            set[expandId(id)] = true;
        });
        return set;
    }

    var KNOWN = {
        items: idSet(IDS.items),
        mobs: idSet(IDS.mobs),
        blocks: idSet(IDS.blocks),
        enchantments: idSet(IDS.enchantments),
        conditions: idSet(IDS.lootConditions),
        functions: idSet(IDS.lootFunctions),
        itemTags: idSet(IDS.itemTags),
        entityTags: idSet(IDS.entityTags),
        blockTags: idSet(IDS.blockTags)
    };

    /** Tells whether a vanilla id is unknown. Ids of other namespaces are never "unknown": they may be modded. */
    function isUnknownVanilla(id, set) {
        var full = expandId(id);
        var bare = full.charAt(0) === "#" ? full.slice(1) : full;
        return bare.indexOf("minecraft:") === 0 && !set[full];
    }

    function prettyId(id) {
        if (!id) return "?";
        if (id === "*") return "everything";
        if (id.charAt(0) === "#") return "anything in " + expandId(id);
        var name = expandId(id).split(":")[1] || id;
        return name
            .split(/[_/]/)
            .map(function (word) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(" ");
    }

    function buildDatalists() {
        var lists = {
            "gen-items": IDS.items,
            "gen-removal-items": ["*"].concat(IDS.items || [], IDS.itemTags || []),
            "gen-mobs": ["*", "minecraft:*"].concat(IDS.mobs || [], IDS.entityTags || []),
            "gen-blocks": ["*", "minecraft:*"].concat(IDS.blocks || [], IDS.blockTags || []),
            "gen-enchantments": IDS.enchantments,
            "gen-mob-ids": IDS.mobs,
            "gen-block-ids": IDS.blocks
        };
        var host = el("div", { hidden: true });
        Object.keys(lists).forEach(function (id) {
            var list = el("datalist", { id: id });
            (lists[id] || []).forEach(function (value) {
                list.appendChild(el("option", { value: value === "*" || value === "minecraft:*" ? value : expandId(value) }));
            });
            host.appendChild(list);
        });
        document.body.appendChild(host);
    }

    /* ======================================================================
     * State
     * ==================================================================== */

    function newDrop(isExperience) {
        var drop = isExperience ? { experience: true } : { item: "minecraft:diamond" };
        drop.chance = isExperience ? 1 : 0.05;
        drop.count = { min: 1, max: isExperience ? 5 : 1 };
        drop.drop_behavior = { type: "uniform" };
        return drop;
    }

    var RECIPES = {
        blank: {
            label: "Blank drop file",
            make: function () {
                return { kind: "mob", namespace: "mypack", name: "zombie_drops", file: { version: 1, entity: "minecraft:zombie", drops: [newDrop(false)] } };
            }
        },
        rare: {
            label: "Rare drop with pity and Looting",
            make: function () {
                return {
                    kind: "mob",
                    namespace: "mypack",
                    name: "enderman_totem",
                    file: {
                        version: 1,
                        entity: "minecraft:enderman",
                        drops: [
                            {
                                item: "minecraft:totem_of_undying",
                                chance: 0.005,
                                count: { min: 1, max: 1 },
                                drop_behavior: { type: "uniform" },
                                enchant_bonus: [
                                    { enchant: "minecraft:looting", on_enchant: { bonus_chance: { bonus_chance_per_level: 0.0025, max_bonus_chance: 0.0075 } } }
                                ],
                                id: "totem",
                                pity: 200,
                                on_drop: { glow: true }
                            }
                        ]
                    }
                };
            }
        },
        remove: {
            label: "Remove a drop (removal file)",
            make: function () {
                return { kind: "mob", namespace: "mypack", name: "zombie_no_flesh", file: { version: 1, entity: "minecraft:zombie", removals: ["minecraft:rotten_flesh"] } };
            }
        },
        real: {
            label: "Drop only for real players",
            make: function () {
                return {
                    kind: "mob",
                    namespace: "mypack",
                    name: "blaze_real_players",
                    file: {
                        version: 1,
                        entity: "minecraft:blaze",
                        conditions: [{ condition: "alkahestdrops:killed_by_real_player" }],
                        drops: [{ item: "minecraft:magma_cream", chance: 0.25, count: { min: 1, max: 2 }, drop_behavior: { type: "uniform" } }]
                    }
                };
            }
        },
        shear: {
            label: "Shear drop",
            make: function () {
                return {
                    kind: "mob",
                    namespace: "mypack",
                    name: "mooshroom_shear",
                    file: {
                        version: 1,
                        entity: "minecraft:mooshroom",
                        drops: [{ item: "minecraft:golden_apple", chance: 0.05, count: { min: 1, max: 1 }, drop_behavior: { type: "uniform" }, on: "shear" }]
                    }
                };
            }
        },
        health: {
            label: "Loot that scales with max health",
            make: function () {
                return {
                    kind: "mob",
                    namespace: "mypack",
                    name: "all_mobs_emeralds",
                    file: {
                        version: 1,
                        entity: "*",
                        conditions: [{ condition: "minecraft:killed_by_player" }],
                        drops: [
                            {
                                item: "minecraft:emerald",
                                chance: 1,
                                count: { min: 0, max: 16 },
                                drop_behavior: { type: "max_health", function: "log", multiplier: 3, divisor: 10 }
                            }
                        ]
                    }
                };
            }
        },
        ore: {
            label: "Ore bonus with Fortune rolls",
            make: function () {
                return {
                    kind: "block",
                    namespace: "mypack",
                    name: "diamond_ore_emerald",
                    file: {
                        version: 1,
                        block: "minecraft:diamond_ore",
                        drops: [
                            {
                                item: "minecraft:emerald",
                                chance: 0.02,
                                count: { min: 1, max: 4 },
                                drop_behavior: { type: "fixed_rolls", rolls: 1, chance_per_roll: 0.5, increment_value: 1 },
                                enchant_bonus: [{ enchant: "minecraft:fortune", on_enchant: { bonus_roll: { bonus_rolls_per_level: 1, max_bonus_rolls: 3 } } }]
                            }
                        ]
                    }
                };
            }
        },
        experience: {
            label: "Block experience with Fortune",
            make: function () {
                return {
                    kind: "block",
                    namespace: "mypack",
                    name: "stone_experience",
                    file: {
                        version: 1,
                        block: "minecraft:stone",
                        drops: [
                            {
                                experience: true,
                                chance: 1,
                                count: { min: 1, max: 3 },
                                drop_behavior: { type: "uniform" },
                                enchant_bonus: [{ enchant: "minecraft:fortune", on_enchant: { bonus_count: { bonus_max_per_level: 1 } } }]
                            }
                        ]
                    }
                };
            }
        }
    };

    var state = RECIPES.blank.make();
    /** Raw text of JSON boxes that do not parse yet, by path key, so a render keeps what the user typed. */
    var rawText = {};
    var rawErrors = {};

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function pathKey(path) {
        return path.join(".");
    }

    function parsePath(text) {
        return text.split(".").map(function (part) {
            return /^\d+$/.test(part) ? parseInt(part, 10) : part;
        });
    }

    function getAt(obj, path) {
        var node = obj;
        for (var i = 0; i < path.length; i++) {
            if (node === null || node === undefined) return undefined;
            node = node[path[i]];
        }
        return node;
    }

    function setAt(obj, path, value) {
        var node = obj;
        for (var i = 0; i < path.length - 1; i++) {
            if (node[path[i]] === undefined || node[path[i]] === null || typeof node[path[i]] !== "object") {
                node[path[i]] = typeof path[i + 1] === "number" ? [] : {};
            }
            node = node[path[i]];
        }
        node[path[path.length - 1]] = value;
    }

    /** Optional objects that disappear when they become empty. */
    var PRUNABLE = { on_drop: true, bonus_chance: true, bonus_roll: true, bonus_count: true };

    function deleteAt(obj, path) {
        var parent = getAt(obj, path.slice(0, -1));
        if (!parent) return;
        if (Array.isArray(parent)) parent.splice(path[path.length - 1], 1);
        else delete parent[path[path.length - 1]];
        var parentKey = path[path.length - 2];
        if (PRUNABLE[parentKey] && parent && !Array.isArray(parent) && Object.keys(parent).length === 0) {
            deleteAt(obj, path.slice(0, -1));
        }
    }

    function folderOf(kind) {
        return kind === "block" ? "block_drops" : "mob_drops";
    }

    function targetKey(kind) {
        return kind === "block" ? "block" : "entity";
    }

    function isDropFile(file) {
        return Array.isArray(file.drops) || file.removals === undefined;
    }

    /* ======================================================================
     * Checks: the rules of the format that the form can test without the game.
     * ==================================================================== */

    var FILE_KEYS = ["$schema", "version", "entity", "block", "conditions", "drops", "removals", "on"];
    var DROP_KEYS = [
        "id", "item", "experience", "chance", "count", "nbt", "drop_behavior", "enchant_bonus", "conditions", "functions",
        "pity", "first_kill", "first_break", "per_player", "on", "interval", "cooldown", "on_drop"
    ];
    var BEHAVIOR_KEYS = ["type", "rolls", "chance_per_roll", "increment_value", "function", "multiplier", "divisor"];

    function isInt(value) {
        return typeof value === "number" && Math.floor(value) === value;
    }

    function enchantHas(drop, test) {
        return Array.isArray(drop.enchant_bonus) && drop.enchant_bonus.some(function (entry) {
            return entry && entry.on_enchant && test(entry.on_enchant);
        });
    }

    function checkConditions(list, path, issues) {
        if (list === undefined) return;
        if (!Array.isArray(list)) {
            issues.push(issue("error", path, "must be an array of loot conditions"));
            return;
        }
        list.forEach(function (condition, i) {
            var p = path + "[" + i + "]";
            if (!condition || typeof condition !== "object" || typeof condition.condition !== "string") {
                issues.push(issue("error", p, "a loot condition needs a \"condition\" type"));
            } else if (!ID_RE.test(condition.condition)) {
                issues.push(issue("error", p + ".condition", "\"" + condition.condition + "\" is not a valid id"));
            } else if (isUnknownVanilla(condition.condition, KNOWN.conditions)) {
                issues.push(issue("error", p + ".condition", "unknown loot condition type " + condition.condition));
            }
        });
    }

    function issue(severity, path, message) {
        return { severity: severity, path: path, message: message };
    }

    function checkUnknownKeys(obj, allowed, path, issues) {
        Object.keys(obj).forEach(function (key) {
            if (allowed.indexOf(key) === -1) {
                issues.push(issue("warning", (path ? path + "." : "") + key, "unknown key, ignored by the game (typo?)"));
            }
        });
    }

    function checkFile(kind, file) {
        var issues = [];
        if (!file || typeof file !== "object" || Array.isArray(file)) return [issue("error", "", "a file must be a JSON object")];
        checkUnknownKeys(file, FILE_KEYS, "", issues);

        if (file.version === undefined) issues.push(issue("error", "version", "missing: add \"version\": 1"));
        else if (file.version !== 1) issues.push(issue("error", "version", "must be 1"));

        var key = targetKey(kind);
        var otherKey = kind === "block" ? "entity" : "block";
        if (file[otherKey] !== undefined) {
            issues.push(issue("error", otherKey, (kind === "block" ? "block" : "mob") + " files use \"" + key + "\""));
        }
        var target = file[key];
        if (target === undefined) issues.push(issue("error", key, "missing: which " + (kind === "block" ? "block" : "mob") + " is the file about?"));
        else if (typeof target !== "string" || !TARGET_RE.test(target)) issues.push(issue("error", key, "not an id, #tag, mod:* or *"));
        else if (target.charAt(0) === "#") {
            if (isUnknownVanilla(target, kind === "block" ? KNOWN.blockTags : KNOWN.entityTags)) {
                issues.push(issue("warning", key, "not a vanilla tag (fine if a datapack defines it)"));
            }
        } else if (target !== "*" && !/:\*$/.test(target) && isUnknownVanilla(target, kind === "block" ? KNOWN.blocks : KNOWN.mobs)) {
            issues.push(issue("warning", key, "not a vanilla " + (kind === "block" ? "block" : "mob") + ": the file is skipped unless a mod adds it"));
        }

        checkConditions(file.conditions, "conditions", issues);

        var hasDrops = file.drops !== undefined;
        var hasRemovals = file.removals !== undefined;
        if (hasDrops && hasRemovals) issues.push(issue("error", "", "a file has drops or removals, never both"));
        if (!hasDrops && !hasRemovals) issues.push(issue("error", "", "add drops or removals"));

        if (kind === "block" && file.on !== undefined) issues.push(issue("error", "on", "triggers are for mob files only"));
        else if (file.on !== undefined && hasDrops) issues.push(issue("warning", "on", "ignored in drop files: set on per drop"));
        else if (file.on !== undefined && TRIGGERS.indexOf(file.on) === -1) issues.push(issue("error", "on", "unknown trigger"));

        if (hasDrops) checkDrops(kind, file, issues);
        if (hasRemovals) checkRemovals(kind, file, issues);
        return issues;
    }

    function checkDrops(kind, file, issues) {
        if (!Array.isArray(file.drops) || file.drops.length === 0) {
            issues.push(issue("error", "drops", "needs at least one drop"));
            return;
        }
        var seenIds = {};
        file.drops.forEach(function (drop, i) {
            var p = "drops[" + i + "]";
            if (!drop || typeof drop !== "object" || Array.isArray(drop)) {
                issues.push(issue("error", p, "a drop must be an object"));
                return;
            }
            checkDrop(kind, drop, p, issues);
            if (typeof drop.id === "string") {
                if (seenIds[drop.id]) issues.push(issue("error", p + ".id", "id \"" + drop.id + "\" is used twice in this file"));
                seenIds[drop.id] = true;
            }
        });
    }

    function checkDrop(kind, drop, p, issues) {
        checkUnknownKeys(drop, DROP_KEYS, p, issues);
        var isMob = kind === "mob";
        var isExperience = drop.experience === true;
        var trigger = drop.on === undefined ? "death" : drop.on;
        var noPlayer = trigger === "lightning" || trigger === "periodic";

        /* What drops */
        if (drop.item !== undefined && isExperience) issues.push(issue("error", p + ".experience", "use item or \"experience\": true, not both"));
        else if (drop.item === undefined && !isExperience) issues.push(issue("error", p + ".item", "missing: which item drops?"));
        else if (drop.item !== undefined) {
            if (typeof drop.item !== "string" || !ID_RE.test(drop.item)) issues.push(issue("error", p + ".item", "not a valid item id"));
            else if (isUnknownVanilla(drop.item, KNOWN.items)) issues.push(issue("warning", p + ".item", "not a vanilla item: skipped unless a mod adds it"));
        }

        /* Chance */
        var chance = drop.chance;
        var hasChanceBonus = enchantHas(drop, function (on) {
            return on.bonus_chance && on.bonus_chance.bonus_chance_per_level > 0;
        });
        if (chance === undefined) issues.push(issue("error", p + ".chance", "missing"));
        else if (typeof chance !== "number") issues.push(issue("error", p + ".chance", "must be a number from 0 to 1"));
        else if (chance < 0) issues.push(issue("error", p + ".chance", "below 0"));
        else if (chance > 1) issues.push(issue("warning", p + ".chance", "above 1, clamped to 1"));
        else if (chance === 0 && !hasChanceBonus) issues.push(issue("error", p + ".chance", "0 needs an enchantment bonus with bonus_chance"));

        /* Count */
        var count = drop.count;
        if (count === undefined) issues.push(issue("error", p + ".count", "missing"));
        else if (typeof count !== "object" || count === null) issues.push(issue("error", p + ".count", "must be { \"min\": ..., \"max\": ... }"));
        else {
            ["min", "max"].forEach(function (k) {
                if (count[k] === undefined) issues.push(issue("error", p + ".count." + k, "missing"));
                else if (!isInt(count[k]) || count[k] < 0) issues.push(issue("error", p + ".count." + k, "must be a whole number, 0 or more"));
            });
            if (isInt(count.min) && isInt(count.max)) {
                if (count.min > count.max) issues.push(issue("error", p + ".count", "min is above max"));
                if (count.max > DEFAULT_LIMIT) issues.push(issue("warning", p + ".count.max", "above max_count (1024 by default), clamped"));
                if (count.min === 0 && count.max === 0) {
                    var raisesMin = enchantHas(drop, function (on) {
                        return on.bonus_count && on.bonus_count.bonus_min_per_level > 0;
                    });
                    var raisesMax = enchantHas(drop, function (on) {
                        return on.bonus_count && on.bonus_count.bonus_max_per_level > 0;
                    });
                    if (!raisesMin || !raisesMax) issues.push(issue("error", p + ".count", "0 to 0 needs enchantment bonuses that raise both min and max"));
                }
            }
        }

        /* Behavior */
        var behavior = drop.drop_behavior;
        var type = behavior && behavior.type;
        if (behavior === undefined) issues.push(issue("error", p + ".drop_behavior", "missing"));
        else if (typeof behavior !== "object" || behavior === null) issues.push(issue("error", p + ".drop_behavior", "must be an object with a type"));
        else {
            checkUnknownKeys(behavior, BEHAVIOR_KEYS, p + ".drop_behavior", issues);
            var bp = p + ".drop_behavior";
            if (type === undefined) issues.push(issue("error", bp + ".type", "missing"));
            else if (BEHAVIORS[kind].indexOf(type) === -1) {
                var msg = type === "hardness" ? "hardness is for block files" : type === "max_health" || type === "damage_taken" ? type + " is for mob files" : "unknown type";
                issues.push(issue("error", bp + ".type", msg));
            } else if (type === "damage_taken" && trigger !== "hit") {
                issues.push(issue("error", bp + ".type", "damage_taken needs \"on\": \"hit\""));
            }
            var isRoll = ROLL_TYPES.indexOf(type) !== -1;
            var isScale = SCALE_TYPES.indexOf(type) !== -1;
            ["rolls", "chance_per_roll", "increment_value"].forEach(function (k) {
                if (isRoll && behavior[k] === undefined) issues.push(issue("error", bp + "." + k, "missing (required by " + type + ")"));
                if (!isRoll && type && behavior[k] !== undefined) issues.push(issue("warning", bp + "." + k, "ignored by " + type));
            });
            ["function", "multiplier", "divisor"].forEach(function (k) {
                if (!isScale && type && behavior[k] !== undefined) issues.push(issue("warning", bp + "." + k, "ignored by " + type));
            });
            if (isRoll) {
                var rollBonus = function (key) {
                    return enchantHas(drop, function (on) {
                        return on.bonus_roll && on.bonus_roll[key] !== undefined;
                    });
                };
                if (behavior.rolls !== undefined) {
                    if (!isInt(behavior.rolls) || behavior.rolls < 0) issues.push(issue("error", bp + ".rolls", "must be a whole number, 0 or more"));
                    else if (behavior.rolls === 0 && !rollBonus("bonus_rolls_per_level")) issues.push(issue("warning", bp + ".rolls", "0 without a rolls bonus becomes 1"));
                    else if (behavior.rolls > DEFAULT_LIMIT) issues.push(issue("warning", bp + ".rolls", "above max_rolls (1024 by default), clamped"));
                }
                if (behavior.chance_per_roll !== undefined) {
                    var cpr = behavior.chance_per_roll;
                    if (typeof cpr !== "number" || cpr < 0) issues.push(issue("error", bp + ".chance_per_roll", "must be from 0 to 1"));
                    else if (cpr > 1) issues.push(issue("warning", bp + ".chance_per_roll", "above 1, clamped to 1"));
                    else if (cpr === 0 && !rollBonus("bonus_roll_chance_per_level")) issues.push(issue("error", bp + ".chance_per_roll", "0 needs a bonus_roll_chance_per_level bonus"));
                }
                if (behavior.increment_value !== undefined) {
                    var inc = behavior.increment_value;
                    if (!isInt(inc) || inc < 0) issues.push(issue("error", bp + ".increment_value", "must be a whole number, 0 or more"));
                    else if (inc === 0 && !rollBonus("bonus_increment_per_level")) issues.push(issue("warning", bp + ".increment_value", "0 without an increment bonus becomes 1"));
                    else if (inc > DEFAULT_LIMIT) issues.push(issue("warning", bp + ".increment_value", "above max_increment (1024 by default), clamped"));
                }
            }
            if (isRoll && count && isInt(count.min) && isInt(count.max) && count.max <= count.min) {
                var raisesMaxCount = enchantHas(drop, function (on) {
                    return on.bonus_count && on.bonus_count.bonus_max_per_level > 0;
                });
                if (!raisesMaxCount) issues.push(issue("warning", p + ".count.max", "rolls can never add anything while max equals min (the game does not warn about this)"));
            }
            if (isScale) {
                if (behavior["function"] !== undefined && ["linear", "log"].indexOf(behavior["function"]) === -1) {
                    issues.push(issue("error", bp + ".function", "must be linear or log"));
                }
                ["multiplier", "divisor"].forEach(function (k) {
                    if (behavior[k] !== undefined && !(typeof behavior[k] === "number" && behavior[k] > 0)) {
                        issues.push(issue("error", bp + "." + k, "must be above 0"));
                    }
                });
            }
        }

        /* Enchantment bonuses */
        if (drop.enchant_bonus !== undefined) {
            var ep = p + ".enchant_bonus";
            if (!Array.isArray(drop.enchant_bonus) || drop.enchant_bonus.length === 0) {
                issues.push(issue("error", ep, "must be a non-empty array"));
            } else {
                if (isMob && noPlayer) issues.push(issue("warning", ep, trigger + " drops read no enchantment: ignored"));
                var seen = {};
                drop.enchant_bonus.forEach(function (entry, i) {
                    checkEnchantEntry(entry, ep + "[" + i + "]", type, seen, issues);
                });
            }
        }

        checkConditions(drop.conditions, p + ".conditions", issues);

        /* Item data */
        if (drop.nbt !== undefined) {
            if (isExperience) issues.push(issue("warning", p + ".nbt", "ignored on experience drops"));
            else if (typeof drop.nbt === "string" && drop.nbt.trim().charAt(0) !== "{") issues.push(issue("error", p + ".nbt", "SNBT must start with {"));
        }
        if (drop.functions !== undefined) checkFunctions(kind, drop, p + ".functions", issues);

        /* Tracking */
        var isOneTime = drop.first_kill === true || drop.first_break === true;
        if (drop.pity !== undefined) {
            if (!isInt(drop.pity) || drop.pity < 1) issues.push(issue("error", p + ".pity", "must be a whole number, 1 or more"));
            else if (isOneTime) issues.push(issue("warning", p + ".pity", "ignored on one-time drops"));
            else if (isMob && noPlayer) issues.push(issue("warning", p + ".pity", trigger + " drops have no player: ignored"));
            else if (chance === 1 && type === "uniform" && count && count.min >= 1) issues.push(issue("warning", p + ".pity", "this drop can never miss, so pity has no effect"));
        }
        if (isMob && drop.first_break !== undefined) issues.push(issue("warning", p + ".first_break", "mob files use first_kill: ignored"));
        if (!isMob && drop.first_kill !== undefined) issues.push(issue("warning", p + ".first_kill", "block files use first_break: ignored"));
        if (isMob && drop.first_kill === true && noPlayer) issues.push(issue("error", p + ".first_kill", trigger + " drops have no player"));
        if (drop.per_player === true) {
            if (!isMob) issues.push(issue("warning", p + ".per_player", "mob files only: ignored"));
            else if (isExperience) issues.push(issue("warning", p + ".per_player", "ignored on experience drops"));
            else if (trigger !== "death") issues.push(issue("warning", p + ".per_player", "death drops only: ignored"));
        }
        if (drop.id !== undefined) {
            if (typeof drop.id !== "string" || !PROGRESS_ID_RE.test(drop.id)) issues.push(issue("error", p + ".id", "use only a-z, 0-9 and _ . / -"));
            else if (drop.pity === undefined && !isOneTime) issues.push(issue("warning", p + ".id", "no effect without pity or a one-time drop"));
        }

        /* Trigger */
        if (!isMob) {
            ["on", "interval", "cooldown"].forEach(function (k) {
                if (drop[k] !== undefined) issues.push(issue(k === "on" ? "error" : "warning", p + "." + k, "triggers are for mob files only"));
            });
        } else {
            if (drop.on !== undefined && TRIGGERS.indexOf(drop.on) === -1) issues.push(issue("error", p + ".on", "unknown trigger"));
            if (drop.interval !== undefined) {
                if (trigger !== "periodic") issues.push(issue("warning", p + ".interval", "only for \"on\": \"periodic\""));
                else if (!isInt(drop.interval) || drop.interval < 1) issues.push(issue("error", p + ".interval", "must be 1 or more"));
            }
            if (drop.cooldown !== undefined) {
                if (trigger !== "hit") issues.push(issue("warning", p + ".cooldown", "only for \"on\": \"hit\""));
                else if (!isInt(drop.cooldown) || drop.cooldown < 0) issues.push(issue("error", p + ".cooldown", "must be 0 or more"));
            }
        }

        /* Drop actions */
        if (drop.on_drop !== undefined) {
            var op = p + ".on_drop";
            var actions = drop.on_drop || {};
            if (isExperience) issues.push(issue("warning", op, "ignored on experience drops"));
            else if (actions.glow !== true && actions.run_function === undefined) issues.push(issue("warning", op, "no action is on: ignored"));
            if (actions.run_function !== undefined && (typeof actions.run_function !== "string" || !ID_RE.test(actions.run_function))) {
                issues.push(issue("error", op + ".run_function", "not a valid function id"));
            }
            checkUnknownKeys(actions, ["glow", "run_function"], op, issues);
        }
        if (isExperience && drop.functions !== undefined) issues.push(issue("warning", p + ".functions", "ignored on experience drops"));
    }

    function checkEnchantEntry(entry, ep, type, seen, issues) {
        if (!entry || typeof entry !== "object") {
            issues.push(issue("error", ep, "must be an object"));
            return;
        }
        if (typeof entry.enchant !== "string") issues.push(issue("error", ep + ".enchant", "missing"));
        else if (!ID_RE.test(entry.enchant)) issues.push(issue("error", ep + ".enchant", "not a valid id"));
        else {
            var full = expandId(entry.enchant);
            if (seen[full]) issues.push(issue("error", ep + ".enchant", "the same enchantment twice in one drop"));
            seen[full] = true;
            if (isUnknownVanilla(entry.enchant, KNOWN.enchantments)) issues.push(issue("warning", ep + ".enchant", "not a vanilla enchantment: entry skipped unless a mod adds it"));
        }
        var on = entry.on_enchant;
        if (!on || typeof on !== "object") {
            issues.push(issue("error", ep + ".on_enchant", "missing"));
            return;
        }
        if (!on.bonus_chance && !on.bonus_roll && !on.bonus_count) issues.push(issue("error", ep + ".on_enchant", "add bonus_chance, bonus_roll or bonus_count"));
        var perLevelChance = function (obj, key, path) {
            if (obj[key] === undefined) return;
            if (typeof obj[key] !== "number" || obj[key] <= 0) issues.push(issue("error", path + "." + key, "must be above 0"));
            else if (obj[key] > 1) issues.push(issue("warning", path + "." + key, "above 1, clamped to 1"));
        };
        var perLevelInt = function (obj, key, path, lowest) {
            if (obj[key] === undefined) return;
            if (!isInt(obj[key]) || obj[key] < lowest) issues.push(issue("error", path + "." + key, "must be a whole number, " + lowest + " or more"));
        };
        var maxNeeds = function (obj, maxKey, perKey, path) {
            if (obj[maxKey] !== undefined && obj[perKey] === undefined) issues.push(issue("error", path + "." + maxKey, "needs " + perKey));
        };
        if (on.bonus_chance) {
            var cp = ep + ".on_enchant.bonus_chance";
            if (on.bonus_chance.bonus_chance_per_level === undefined) issues.push(issue("error", cp + ".bonus_chance_per_level", "missing"));
            perLevelChance(on.bonus_chance, "bonus_chance_per_level", cp);
        }
        if (on.bonus_roll) {
            var rp = ep + ".on_enchant.bonus_roll";
            if (type && ROLL_TYPES.indexOf(type) === -1) issues.push(issue("warning", rp, "only applies to fixed_rolls and chained_rolls"));
            var r = on.bonus_roll;
            if (r.bonus_rolls_per_level === undefined && r.bonus_roll_chance_per_level === undefined && r.bonus_increment_per_level === undefined) {
                issues.push(issue("error", rp, "add a per-level key"));
            }
            perLevelInt(r, "bonus_rolls_per_level", rp, 1);
            perLevelChance(r, "bonus_roll_chance_per_level", rp);
            perLevelInt(r, "bonus_increment_per_level", rp, 1);
            maxNeeds(r, "max_bonus_rolls", "bonus_rolls_per_level", rp);
            maxNeeds(r, "max_bonus_roll_chance", "bonus_roll_chance_per_level", rp);
            maxNeeds(r, "max_bonus_increment", "bonus_increment_per_level", rp);
        }
        if (on.bonus_count) {
            var np = ep + ".on_enchant.bonus_count";
            var c = on.bonus_count;
            if (c.bonus_min_per_level === undefined && c.bonus_max_per_level === undefined) issues.push(issue("error", np, "add bonus_min_per_level or bonus_max_per_level"));
            perLevelInt(c, "bonus_min_per_level", np, 0);
            perLevelInt(c, "bonus_max_per_level", np, 0);
            maxNeeds(c, "max_bonus_min", "bonus_min_per_level", np);
            maxNeeds(c, "max_bonus_max", "bonus_max_per_level", np);
        }
    }

    function checkFunctions(kind, drop, path, issues) {
        if (!Array.isArray(drop.functions)) {
            issues.push(issue("error", path, "must be an array of loot functions"));
            return;
        }
        var hasLootingBonus = Array.isArray(drop.enchant_bonus) && drop.enchant_bonus.some(function (entry) {
            return entry && typeof entry.enchant === "string" && expandId(entry.enchant) === "minecraft:looting";
        });
        drop.functions.forEach(function (fn, i) {
            var p = path + "[" + i + "]";
            if (!fn || typeof fn !== "object" || typeof fn["function"] !== "string") {
                issues.push(issue("error", p, "a loot function needs a \"function\" type"));
                return;
            }
            var id = expandId(fn["function"]);
            if (!ID_RE.test(fn["function"])) issues.push(issue("error", p + ".function", "not a valid id"));
            else if (isUnknownVanilla(id, KNOWN.functions)) issues.push(issue("error", p + ".function", "unknown loot function type"));
            if (id === "minecraft:set_count" && fn.add !== true) issues.push(issue("warning", p, "without \"add\": true, set_count replaces the rolled count"));
            if (id === "minecraft:looting_enchant" && kind === "block") issues.push(issue("warning", p, "block drops have no killer, so looting_enchant does nothing"));
            if (id === "minecraft:looting_enchant" && hasLootingBonus) issues.push(issue("warning", p, "both looting_enchant and the Looting enchant_bonus apply"));
            if (id === "minecraft:apply_bonus" && kind === "mob") issues.push(issue("warning", p, "mob drops have no tool, so apply_bonus does nothing"));
            checkConditions(fn.conditions, p + ".conditions", issues);
        });
    }

    function checkRemovals(kind, file, issues) {
        if (!Array.isArray(file.removals) || file.removals.length === 0) {
            issues.push(issue("error", "removals", "needs at least one entry"));
            return;
        }
        var target = file[targetKey(kind)];
        if (kind === "mob" && (target === "minecraft:player" || target === "player")) {
            issues.push(issue("error", "entity", "removal files cannot target players"));
        }
        file.removals.forEach(function (entry, i) {
            var p = "removals[" + i + "]";
            if (typeof entry === "string") {
                checkRemovalItem(entry, p, issues);
                return;
            }
            if (!entry || typeof entry !== "object") {
                issues.push(issue("error", p, "an item id, #tag, * or an object"));
                return;
            }
            checkUnknownKeys(entry, ["item", "experience", "conditions"], p, issues);
            if (entry.item !== undefined && entry.experience === true) issues.push(issue("error", p + ".experience", "use item or experience, not both"));
            else if (entry.item !== undefined) {
                checkRemovalItem(entry.item, p + ".item", issues);
                if (entry.conditions === undefined) issues.push(issue("error", p + ".conditions", "required with item (use the plain string form without conditions)"));
            } else if (entry.experience !== true) issues.push(issue("error", p, "needs item or \"experience\": true"));
            checkConditions(entry.conditions, p + ".conditions", issues);
        });
    }

    function checkRemovalItem(value, p, issues) {
        if (typeof value !== "string" || !REMOVAL_RE.test(value)) issues.push(issue("error", p, "an item id, #tag or *"));
        else if (value.charAt(0) === "#") {
            if (isUnknownVanilla(value, KNOWN.itemTags)) issues.push(issue("warning", p, "not a vanilla item tag (fine if a datapack defines it)"));
        } else if (value !== "*" && isUnknownVanilla(value, KNOWN.items)) {
            issues.push(issue("warning", p, "not a vanilla item: skipped unless a mod adds it"));
        }
    }

    /* ======================================================================
     * Plain-English preview
     * ==================================================================== */

    function percent(value) {
        if (typeof value !== "number") return "?%";
        var p = value * 100;
        var text = p >= 10 || p === Math.round(p) ? String(Math.round(p * 100) / 100) : String(Math.round(p * 1000) / 1000);
        return text + "%";
    }

    function range(min, max) {
        if (min === undefined || max === undefined) return "?";
        return min === max ? String(min) : min + "–" + max;
    }

    function enchantName(id) {
        return prettyId(id || "?");
    }

    var CONDITION_NAMES = {
        "minecraft:killed_by_player": "killed by a player",
        "alkahestdrops:killed_by_real_player": "killed by a real player",
        "alkahestdrops:broken_by_real_player": "broken by a real player",
        "minecraft:random_chance": "a random chance passes",
        "minecraft:match_tool": "the tool matches",
        "minecraft:entity_properties": "an entity check passes",
        "minecraft:inverted": "a condition fails"
    };

    function describeConditions(list) {
        if (!Array.isArray(list) || list.length === 0) return "";
        var names = list.map(function (c) {
            var id = c && typeof c.condition === "string" ? expandId(c.condition) : "?";
            if (id === "minecraft:inverted" && c.term && c.term.condition && expandId(c.term.condition) === "minecraft:killed_by_player") return "not killed by a player";
            if (id === "minecraft:random_chance" && typeof c.chance === "number") return "a " + percent(c.chance) + " random chance passes";
            if (id === "minecraft:entity_properties" && c.predicate && c.predicate.flags) {
                var flags = Object.keys(c.predicate.flags).join(", ").replace(/_/g, " ");
                return (c.entity === "killer" ? "the killer " : "the entity ") + "is " + flags.replace(/^is /, "");
            }
            if (id === "minecraft:match_tool" && JSON.stringify(c).indexOf("silk_touch") !== -1) return "the tool has Silk Touch";
            return CONDITION_NAMES[id] || id;
        });
        return names.join(" and ");
    }

    function describeBehavior(drop) {
        var b = drop.drop_behavior || {};
        var c = drop.count || {};
        var unit = drop.experience === true ? " experience" : " " + prettyId(drop.item);
        switch (b.type) {
            case "fixed_rolls":
                return c.min + unit + ", then " + b.rolls + " roll(s) at " + percent(b.chance_per_roll) + " each adding " + b.increment_value + " (at most " + c.max + ")";
            case "chained_rolls":
                return c.min + unit + ", then +" + b.increment_value + " for each roll at " + percent(b.chance_per_roll) + " until one fails (up to " + b.rolls + " rolls, at most " + c.max + ")";
            case "max_health":
            case "hardness":
            case "damage_taken":
                var what = b.type === "max_health" ? "max health" : b.type === "hardness" ? "hardness" : "damage taken";
                var f = b["function"] === "log" ? "ln" : "";
                return unit.trim() + " by " + what + ": " + (b.multiplier || 1) + " × " + f + "(" + what + " ÷ " + (b.divisor || 1) + "), from " + range(c.min, c.max);
            default:
                return range(c.min, c.max) + unit;
        }
    }

    function describeEnchants(drop) {
        if (!Array.isArray(drop.enchant_bonus)) return [];
        return drop.enchant_bonus.map(function (entry) {
            var parts = [];
            var on = (entry && entry.on_enchant) || {};
            if (on.bonus_chance) {
                parts.push("+" + percent(on.bonus_chance.bonus_chance_per_level) + " chance per level" +
                    (on.bonus_chance.max_bonus_chance !== undefined ? " (up to +" + percent(on.bonus_chance.max_bonus_chance) + ")" : ""));
            }
            if (on.bonus_count) {
                if (on.bonus_count.bonus_min_per_level) parts.push("+" + on.bonus_count.bonus_min_per_level + " min count per level");
                if (on.bonus_count.bonus_max_per_level) parts.push("+" + on.bonus_count.bonus_max_per_level + " max count per level");
            }
            if (on.bonus_roll) {
                if (on.bonus_roll.bonus_rolls_per_level) parts.push("+" + on.bonus_roll.bonus_rolls_per_level + " roll(s) per level");
                if (on.bonus_roll.bonus_roll_chance_per_level) parts.push("+" + percent(on.bonus_roll.bonus_roll_chance_per_level) + " roll chance per level");
                if (on.bonus_roll.bonus_increment_per_level) parts.push("+" + on.bonus_roll.bonus_increment_per_level + " increment per level");
            }
            return enchantName(entry && entry.enchant) + ": " + (parts.join(", ") || "no bonus yet");
        });
    }

    function describeTrigger(kind, drop) {
        if (kind === "block") return "When broken";
        switch (drop.on) {
            case "shear":
                return "When sheared";
            case "hit":
                return "When hit" + (drop.cooldown ? " (then waits " + drop.cooldown / 20 + " s)" : "");
            case "lightning":
                return "When struck by lightning";
            case "periodic":
                var ticks = drop.interval || 6000;
                return "Every " + (ticks % 1200 === 0 ? ticks / 1200 + " min" : ticks / 20 + " s") + " while alive";
            default:
                return "When killed";
        }
    }

    function describeDrop(kind, drop) {
        var lines = [];
        var head = describeTrigger(kind, drop) + ": ";
        head += drop.chance === 1 ? "always drops " : percent(drop.chance) + " chance to drop ";
        head += describeBehavior(drop) + ".";
        lines.push(head);
        describeEnchants(drop).forEach(function (text) {
            lines.push(text + ".");
        });
        var cond = describeConditions(drop.conditions);
        if (cond) lines.push("Only if " + cond + ".");
        if (drop.first_kill === true || drop.first_break === true) lines.push("Once per player, ignoring the chance.");
        else if (drop.pity) lines.push("Guaranteed after " + (drop.pity - 1) + " misses in a row (per player).");
        if (drop.per_player === true) lines.push("Every attacker gets their own roll.");
        if (Array.isArray(drop.functions) && drop.functions.length) lines.push(drop.functions.length + " loot function(s) applied.");
        if (drop.on_drop) {
            var actions = [];
            if (drop.on_drop.glow) actions.push("glows");
            if (drop.on_drop.run_function) actions.push("runs " + drop.on_drop.run_function);
            if (actions.length) lines.push("When it lands: " + actions.join(" and ") + ".");
        }
        return lines;
    }

    function describeRemoval(entry) {
        if (typeof entry === "string") return "Removes " + prettyId(entry) + ".";
        if (!entry) return "?";
        var what = entry.experience === true ? "all experience" : prettyId(entry.item);
        var cond = describeConditions(entry.conditions);
        return "Removes " + what + (cond ? " when " + cond : "") + ".";
    }

    /* ======================================================================
     * Form
     * ==================================================================== */

    var form = root.querySelector("[data-gen-form]");
    var output = root.querySelector("[data-gen-output]");

    function field(label, input, hint) {
        return el("label", { className: "gen-field" }, [
            el("span", { className: "gen-field__label" }, [label]),
            input,
            hint ? el("span", { className: "gen-field__hint" }, [hint]) : null
        ]);
    }

    function textInput(path, value, attrs) {
        var a = { type: "text", "data-path": pathKey(path), value: value === undefined ? "" : String(value), spellcheck: "false", autocomplete: "off" };
        Object.keys(attrs || {}).forEach(function (k) {
            a[k] = attrs[k];
        });
        return el("input", a);
    }

    function numberInput(path, value, kindOfNumber, attrs) {
        var a = { type: "number", "data-path": pathKey(path), "data-num": kindOfNumber, value: value === undefined ? "" : String(value) };
        Object.keys(attrs || {}).forEach(function (k) {
            a[k] = attrs[k];
        });
        if (kindOfNumber === "int") a.step = "1";
        if (kindOfNumber === "percent") {
            a.step = "any";
            a.value = value === undefined ? "" : String(Math.round(value * 1e8) / 1e6);
        }
        if (kindOfNumber === "float") a.step = "any";
        return el("input", a);
    }

    function select(path, value, options, attrs) {
        var a = { "data-path": pathKey(path) };
        Object.keys(attrs || {}).forEach(function (k) {
            a[k] = attrs[k];
        });
        var s = el("select", a);
        options.forEach(function (opt) {
            var o = el("option", { value: opt[0] }, [opt[1]]);
            if (String(value === undefined ? "" : value) === opt[0]) o.selected = true;
            s.appendChild(o);
        });
        return s;
    }

    function checkbox(path, checked, label, attrs) {
        var a = { type: "checkbox", "data-path": pathKey(path), "data-bool": "true" };
        Object.keys(attrs || {}).forEach(function (k) {
            a[k] = attrs[k];
        });
        var input = el("input", a);
        input.checked = !!checked;
        return el("label", { className: "gen-check" }, [input, el("span", null, [label])]);
    }

    function button(label, action, data, className) {
        var attrs = { type: "button", className: "gen-button" + (className ? " " + className : ""), "data-action": action };
        Object.keys(data || {}).forEach(function (k) {
            attrs["data-" + k] = data[k];
        });
        return el("button", attrs, [label]);
    }

    function jsonBox(path, value, placeholder) {
        var key = pathKey(path);
        var text = rawText[key] !== undefined ? rawText[key] : value === undefined ? "" : JSON.stringify(value, null, 2);
        var area = el("textarea", {
            className: "gen-json" + (rawErrors[key] ? " has-error" : ""),
            "data-path": key,
            "data-json": "true",
            rows: String(Math.min(12, Math.max(3, text.split("\n").length + 1))),
            spellcheck: "false",
            placeholder: placeholder || ""
        });
        area.value = text;
        var wrap = el("div", { className: "gen-json-wrap" }, [area]);
        if (rawErrors[key]) wrap.appendChild(el("p", { className: "gen-json-error" }, [rawErrors[key]]));
        return wrap;
    }

    var CONDITION_PRESETS = {
        mob: [
            ["Killed by a player", { condition: "minecraft:killed_by_player" }],
            ["Killed by a real player", { condition: "alkahestdrops:killed_by_real_player" }],
            ["Not killed by a player", { condition: "minecraft:inverted", term: { condition: "minecraft:killed_by_player" } }],
            ["Killer sneaking", { condition: "minecraft:entity_properties", entity: "killer", predicate: { flags: { is_sneaking: true } } }],
            ["Mob on fire", { condition: "minecraft:entity_properties", entity: "this", predicate: { flags: { is_on_fire: true } } }],
            ["50% random", { condition: "minecraft:random_chance", chance: 0.5 }]
        ],
        block: [
            ["Broken by a real player", { condition: "alkahestdrops:broken_by_real_player" }],
            ["Silk Touch", { condition: "minecraft:match_tool", predicate: { enchantments: [{ enchantment: "minecraft:silk_touch", levels: { min: 1 } }] } }],
            ["No Silk Touch", { condition: "minecraft:inverted", term: { condition: "minecraft:match_tool", predicate: { enchantments: [{ enchantment: "minecraft:silk_touch", levels: { min: 1 } }] } } }],
            ["Breaker sneaking", { condition: "minecraft:entity_properties", entity: "this", predicate: { flags: { is_sneaking: true } } }],
            ["50% random", { condition: "minecraft:random_chance", chance: 0.5 }]
        ]
    };

    var FUNCTION_PRESETS = [
        ["Random enchantment", { "function": "minecraft:enchant_randomly" }],
        ["Enchant at level 30", { "function": "minecraft:enchant_with_levels", levels: 30, treasure: false }],
        ["Smelt", { "function": "minecraft:furnace_smelt" }],
        ["Custom name", { "function": "minecraft:set_name", name: { text: "Special Item", color: "gold", italic: false } }]
    ];

    function conditionsEditor(path, list) {
        var presets = el("div", { className: "gen-presets" }, [el("span", { className: "gen-presets__label" }, ["Add:"])]);
        CONDITION_PRESETS[state.kind].forEach(function (preset, i) {
            presets.appendChild(button(preset[0], "add-condition", { target: pathKey(path), preset: String(i) }, "gen-chip"));
        });
        return el("div", { className: "gen-sub" }, [presets, jsonBox(path, list, "[ ]  (no conditions)")]);
    }

    function functionsEditor(path, list) {
        var presets = el("div", { className: "gen-presets" }, [el("span", { className: "gen-presets__label" }, ["Add:"])]);
        FUNCTION_PRESETS.forEach(function (preset, i) {
            presets.appendChild(button(preset[0], "add-function", { target: pathKey(path), preset: String(i) }, "gen-chip"));
        });
        return el("div", { className: "gen-sub" }, [presets, jsonBox(path, list, "[ ]  (no functions)")]);
    }

    function section(title, children, extraClass) {
        return el("section", { className: "gen-section" + (extraClass ? " " + extraClass : "") }, [el("h3", { className: "gen-section__title" }, [title])].concat(children));
    }

    function renderFileSection() {
        var file = state.file;
        var key = targetKey(state.kind);
        var isDrops = isDropFile(file);
        var kindToggle = el("div", { className: "gen-toggle", role: "group", "aria-label": "Mob or block file" }, [
            button("Mob file", "set-kind", { value: "mob" }, state.kind === "mob" ? "is-on" : ""),
            button("Block file", "set-kind", { value: "block" }, state.kind === "block" ? "is-on" : "")
        ]);
        var typeToggle = el("div", { className: "gen-toggle", role: "group", "aria-label": "Drop or removal file" }, [
            button("Adds drops", "set-type", { value: "drops" }, isDrops ? "is-on" : ""),
            button("Removes drops", "set-type", { value: "removals" }, !isDrops ? "is-on" : "")
        ]);
        var children = [
            el("div", { className: "gen-row" }, [kindToggle, typeToggle]),
            el("div", { className: "gen-grid" }, [
                field(state.kind === "block" ? "Block (block)" : "Mob (entity)",
                    textInput(["file", key], file[key], { list: state.kind === "block" ? "gen-blocks" : "gen-mobs", placeholder: state.kind === "block" ? "minecraft:stone" : "minecraft:zombie" }),
                    "An id, #tag, mod:* or *"),
                field("Namespace", el("input", { type: "text", "data-meta": "namespace", value: state.namespace, spellcheck: "false", autocomplete: "off" }), "Your pack's folder under data/"),
                field("File name", el("input", { type: "text", "data-meta": "name", value: state.name, spellcheck: "false", autocomplete: "off" }), "Without .json")
            ])
        ];
        if (!isDrops && state.kind === "mob") {
            children.push(el("div", { className: "gen-grid" }, [
                field("Removes drops of", select(["file", "on"], file.on, [["", "death (default)"], ["shear", "shear"], ["hit", "hit"], ["lightning", "lightning"], ["periodic", "periodic"]], { "data-empty": "delete" }))
            ]));
        }
        children.push(el("details", { className: "gen-details", open: file.conditions && file.conditions.length ? true : null }, [
            el("summary", null, ["Global conditions" + (file.conditions && file.conditions.length ? " (" + file.conditions.length + ")" : "")]),
            el("p", { className: "gen-help" }, ["Gate every entry of the file. When one fails, the whole file is skipped for that kill or break."]),
            conditionsEditor(["file", "conditions"], file.conditions)
        ]));
        return section("File", children);
    }

    function renderBehavior(path, drop) {
        var b = drop.drop_behavior || {};
        var options = BEHAVIORS[state.kind].map(function (t) {
            return [t, t];
        });
        var fields = [field("Behavior", select(path.concat(["drop_behavior", "type"]), b.type, options, { "data-rerender": "true" }))];
        if (ROLL_TYPES.indexOf(b.type) !== -1) {
            fields.push(field("Rolls", numberInput(path.concat(["drop_behavior", "rolls"]), b.rolls, "int", { min: "0" })));
            fields.push(field("Chance per roll (%)", numberInput(path.concat(["drop_behavior", "chance_per_roll"]), b.chance_per_roll, "percent", { min: "0", max: "100" })));
            fields.push(field("Increment", numberInput(path.concat(["drop_behavior", "increment_value"]), b.increment_value, "int", { min: "0" })));
        } else if (SCALE_TYPES.indexOf(b.type) !== -1) {
            fields.push(field("Function", select(path.concat(["drop_behavior", "function"]), b["function"], [["", "linear (default)"], ["log", "log"], ["linear", "linear"]], { "data-empty": "delete" })));
            fields.push(field("Multiplier", numberInput(path.concat(["drop_behavior", "multiplier"]), b.multiplier, "float", { min: "0", placeholder: "1" })));
            fields.push(field("Divisor", numberInput(path.concat(["drop_behavior", "divisor"]), b.divisor, "float", { min: "0", placeholder: "1" })));
        }
        return el("div", { className: "gen-grid" }, fields);
    }

    function renderEnchant(path, entry, index, type) {
        var ep = path.concat(["enchant_bonus", index]);
        var on = (entry && entry.on_enchant) || {};
        var onp = ep.concat(["on_enchant"]);
        var rows = [
            el("div", { className: "gen-enchant__head" }, [
                field("Enchantment", textInput(ep.concat(["enchant"]), entry && entry.enchant, { list: "gen-enchantments", placeholder: "minecraft:looting" })),
                button("Remove", "remove-item", { target: pathKey(ep) }, "gen-button--quiet")
            ]),
            el("div", { className: "gen-grid gen-grid--tight" }, [
                field("Chance per level (%)", numberInput(onp.concat(["bonus_chance", "bonus_chance_per_level"]), on.bonus_chance && on.bonus_chance.bonus_chance_per_level, "percent", { min: "0", max: "100" })),
                field("Max chance bonus (%)", numberInput(onp.concat(["bonus_chance", "max_bonus_chance"]), on.bonus_chance && on.bonus_chance.max_bonus_chance, "percent", { min: "0", max: "100", placeholder: "no cap" })),
                field("Min count per level", numberInput(onp.concat(["bonus_count", "bonus_min_per_level"]), on.bonus_count && on.bonus_count.bonus_min_per_level, "int", { min: "0" })),
                field("Max min bonus", numberInput(onp.concat(["bonus_count", "max_bonus_min"]), on.bonus_count && on.bonus_count.max_bonus_min, "int", { min: "0", placeholder: "no cap" })),
                field("Max count per level", numberInput(onp.concat(["bonus_count", "bonus_max_per_level"]), on.bonus_count && on.bonus_count.bonus_max_per_level, "int", { min: "0" })),
                field("Max max bonus", numberInput(onp.concat(["bonus_count", "max_bonus_max"]), on.bonus_count && on.bonus_count.max_bonus_max, "int", { min: "0", placeholder: "no cap" }))
            ])
        ];
        if (ROLL_TYPES.indexOf(type) !== -1 || on.bonus_roll) {
            rows.push(el("div", { className: "gen-grid gen-grid--tight" }, [
                field("Rolls per level", numberInput(onp.concat(["bonus_roll", "bonus_rolls_per_level"]), on.bonus_roll && on.bonus_roll.bonus_rolls_per_level, "int", { min: "1" })),
                field("Max rolls bonus", numberInput(onp.concat(["bonus_roll", "max_bonus_rolls"]), on.bonus_roll && on.bonus_roll.max_bonus_rolls, "int", { min: "1", placeholder: "no cap" })),
                field("Roll chance per level (%)", numberInput(onp.concat(["bonus_roll", "bonus_roll_chance_per_level"]), on.bonus_roll && on.bonus_roll.bonus_roll_chance_per_level, "percent", { min: "0", max: "100" })),
                field("Max roll chance bonus (%)", numberInput(onp.concat(["bonus_roll", "max_bonus_roll_chance"]), on.bonus_roll && on.bonus_roll.max_bonus_roll_chance, "percent", { min: "0", max: "100", placeholder: "no cap" })),
                field("Increment per level", numberInput(onp.concat(["bonus_roll", "bonus_increment_per_level"]), on.bonus_roll && on.bonus_roll.bonus_increment_per_level, "int", { min: "1" })),
                field("Max increment bonus", numberInput(onp.concat(["bonus_roll", "max_bonus_increment"]), on.bonus_roll && on.bonus_roll.max_bonus_increment, "int", { min: "1", placeholder: "no cap" }))
            ]));
        }
        return el("div", { className: "gen-enchant" }, rows);
    }

    function dropTitle(drop, index) {
        return "Drop " + (index + 1) + (drop.experience === true ? " · experience" : drop.item ? " · " + prettyId(drop.item) : "");
    }

    function fillDropPreview(node, drop) {
        node.innerHTML = "";
        describeDrop(state.kind, drop).forEach(function (line) {
            node.appendChild(el("p", null, [line]));
        });
    }

    /** Updates the previews and titles of the cards after a typed change, which does not rebuild the form. */
    function refreshPreviews() {
        var file = state.file;
        Array.prototype.forEach.call(form.querySelectorAll("[data-drop-preview]"), function (node) {
            var i = parseInt(node.getAttribute("data-drop-preview"), 10);
            var drop = Array.isArray(file.drops) ? file.drops[i] : null;
            if (drop && typeof drop === "object") fillDropPreview(node, drop);
        });
        Array.prototype.forEach.call(form.querySelectorAll("[data-drop-title]"), function (node) {
            var i = parseInt(node.getAttribute("data-drop-title"), 10);
            var drop = Array.isArray(file.drops) ? file.drops[i] : null;
            if (drop && typeof drop === "object") node.textContent = dropTitle(drop, i);
        });
        Array.prototype.forEach.call(form.querySelectorAll("[data-removal-preview]"), function (node) {
            var i = parseInt(node.getAttribute("data-removal-preview"), 10);
            var entry = Array.isArray(file.removals) ? file.removals[i] : undefined;
            if (entry !== undefined) node.firstChild.textContent = describeRemoval(entry);
        });
    }

    function renderDrop(drop, index, total) {
        var path = ["file", "drops", index];
        var isMob = state.kind === "mob";
        var isExperience = drop.experience === true;
        var trigger = drop.on || "death";
        var preview = el("div", { className: "gen-preview", "data-drop-preview": String(index) });
        fillDropPreview(preview, drop);

        var head = el("div", { className: "gen-card__head" }, [
            el("h4", { className: "gen-card__title", "data-drop-title": String(index) }, [dropTitle(drop, index)]),
            el("div", { className: "gen-card__tools" }, [
                index > 0 ? button("↑", "move", { index: String(index), dir: "-1" }, "gen-icon") : null,
                index < total - 1 ? button("↓", "move", { index: String(index), dir: "1" }, "gen-icon") : null,
                button("Duplicate", "duplicate", { index: String(index) }, "gen-button--quiet"),
                button("Remove", "remove-item", { target: pathKey(path) }, "gen-button--quiet")
            ])
        ]);

        var what = el("div", { className: "gen-grid" }, [
            field("Drops", select(["meta", "what", index], isExperience ? "experience" : "item", [["item", "an item"], ["experience", "experience"]], { "data-action-change": "set-what", "data-index": String(index) })),
            isExperience ? null : field("Item", textInput(path.concat(["item"]), drop.item, { list: "gen-items", placeholder: "minecraft:diamond" })),
            field("Chance (%)", numberInput(path.concat(["chance"]), drop.chance, "percent", { min: "0", max: "100" })),
            field(isExperience ? "Experience min" : "Count min", numberInput(path.concat(["count", "min"]), drop.count && drop.count.min, "int", { min: "0" })),
            field(isExperience ? "Experience max" : "Count max", numberInput(path.concat(["count", "max"]), drop.count && drop.count.max, "int", { min: "0" }))
        ]);

        var parts = [head, preview, what, renderBehavior(path, drop)];

        if (isMob) {
            var triggerFields = [field("Trigger", select(path.concat(["on"]), drop.on, [["", "death (default)"], ["shear", "shear"], ["hit", "hit"], ["lightning", "lightning"], ["periodic", "periodic"]], { "data-empty": "delete", "data-rerender": "true" }))];
            if (trigger === "periodic") triggerFields.push(field("Interval (ticks)", numberInput(path.concat(["interval"]), drop.interval, "int", { min: "1", placeholder: "6000" }), "20 ticks = 1 s"));
            if (trigger === "hit") triggerFields.push(field("Cooldown (ticks)", numberInput(path.concat(["cooldown"]), drop.cooldown, "int", { min: "0", placeholder: "0" })));
            parts.push(el("div", { className: "gen-grid" }, triggerFields));
        }

        var enchants = el("div", { className: "gen-sub" });
        (Array.isArray(drop.enchant_bonus) ? drop.enchant_bonus : []).forEach(function (entry, i) {
            enchants.appendChild(renderEnchant(path, entry, i, drop.drop_behavior && drop.drop_behavior.type));
        });
        enchants.appendChild(el("div", { className: "gen-presets" }, [
            el("span", { className: "gen-presets__label" }, ["Add:"]),
            button(isMob ? "Looting" : "Fortune", "add-enchant", { index: String(index), enchant: isMob ? "minecraft:looting" : "minecraft:fortune" }, "gen-chip"),
            button("Other enchantment", "add-enchant", { index: String(index), enchant: "" }, "gen-chip")
        ]));
        var enchantCount = Array.isArray(drop.enchant_bonus) ? drop.enchant_bonus.length : 0;
        parts.push(el("details", { className: "gen-details", open: enchantCount ? true : null }, [
            el("summary", null, ["Enchantment bonuses" + (enchantCount ? " (" + enchantCount + ")" : "")]),
            el("p", { className: "gen-help" }, ["Bonus = per-level value × level of the held item's enchantment, capped by its max."]),
            enchants
        ]));

        var condCount = Array.isArray(drop.conditions) ? drop.conditions.length : 0;
        parts.push(el("details", { className: "gen-details", open: condCount ? true : null }, [
            el("summary", null, ["Conditions" + (condCount ? " (" + condCount + ")" : "")]),
            conditionsEditor(path.concat(["conditions"]), drop.conditions)
        ]));

        var tracking = [
            field("Pity (misses)", numberInput(path.concat(["pity"]), drop.pity, "int", { min: "1", placeholder: "off" }), "Forced on this roll"),
            field("Progress id", textInput(path.concat(["id"]), drop.id, { placeholder: "rare_star" }), "Keeps progress when the file changes")
        ];
        var checks = [checkbox(path.concat([isMob ? "first_kill" : "first_break"]), drop[isMob ? "first_kill" : "first_break"], isMob ? "Once per player (first_kill)" : "Once per player (first_break)")];
        if (isMob && trigger === "death" && !isExperience) checks.push(checkbox(path.concat(["per_player"]), drop.per_player, "Own roll for every attacker (per_player)"));
        var advanced = [el("div", { className: "gen-grid" }, tracking), el("div", { className: "gen-row" }, checks)];
        if (!isExperience) {
            advanced.push(el("div", { className: "gen-grid" }, [
                field("Run function when it lands", textInput(path.concat(["on_drop", "run_function"]), drop.on_drop && drop.on_drop.run_function, { placeholder: "mypack:legendary_drop" })),
                field("NBT (SNBT)", textInput(path.concat(["nbt"]), typeof drop.nbt === "string" ? drop.nbt : drop.nbt ? JSON.stringify(drop.nbt) : "", { placeholder: "{display:{Name:'\"Ruby\"'}}" }))
            ]));
            advanced.push(el("div", { className: "gen-row" }, [checkbox(path.concat(["on_drop", "glow"]), drop.on_drop && drop.on_drop.glow, "Glow when it lands")]));
            advanced.push(el("p", { className: "gen-help" }, ["Loot functions"]));
            advanced.push(functionsEditor(path.concat(["functions"]), drop.functions));
        }
        parts.push(el("details", { className: "gen-details", open: drop.pity || drop.id || drop.first_kill || drop.first_break || drop.per_player || drop.on_drop || drop.nbt || drop.functions ? true : null }, [
            el("summary", null, ["Pity, one-time, actions, NBT and functions"])
        ].concat(advanced)));

        parts.push(el("div", { className: "gen-card__foot" }, [button("Simulate this drop", "simulate", { index: String(index) }, "gen-button--quiet")]));
        return el("article", { className: "gen-card" }, parts);
    }

    function renderRemoval(entry, index) {
        var path = ["file", "removals", index];
        var isObject = entry && typeof entry === "object";
        var mode = typeof entry === "string" ? (entry === "*" ? "all" : entry.charAt(0) === "#" ? "tag" : "item") : entry && entry.experience === true ? "experience" : "conditional";
        var fields = [
            field("Removes", select(["meta", "removal", index], mode, [["item", "an item"], ["tag", "an item tag"], ["all", "every item (*)"], ["experience", "experience"], ["conditional", "an item, with conditions"]], { "data-action-change": "set-removal-mode", "data-index": String(index) }))
        ];
        if (mode === "item" || mode === "tag") fields.push(field(mode === "tag" ? "Item tag" : "Item", textInput(path, entry, { list: "gen-removal-items", placeholder: mode === "tag" ? "#minecraft:wool" : "minecraft:rotten_flesh" })));
        if (mode === "conditional") fields.push(field("Item, #tag or *", textInput(path.concat(["item"]), entry.item, { list: "gen-removal-items" })));
        var parts = [
            el("div", { className: "gen-card__head" }, [
                el("h4", { className: "gen-card__title" }, ["Removal " + (index + 1)]),
                el("div", { className: "gen-card__tools" }, [button("Remove", "remove-item", { target: pathKey(path) }, "gen-button--quiet")])
            ]),
            el("div", { className: "gen-preview", "data-removal-preview": String(index) }, [el("p", null, [describeRemoval(entry)])]),
            el("div", { className: "gen-grid" }, fields)
        ];
        if (isObject) {
            parts.push(el("details", { className: "gen-details", open: true }, [
                el("summary", null, ["Conditions" + (mode === "conditional" ? " (required)" : "")]),
                conditionsEditor(path.concat(["conditions"]), entry.conditions)
            ]));
        }
        return el("article", { className: "gen-card" }, parts);
    }

    function render() {
        var focused = document.activeElement;
        var focusKey = focused && focused.getAttribute && (focused.getAttribute("data-path") || focused.getAttribute("data-meta"));
        var selStart = focused && "selectionStart" in focused ? safeSelection(focused) : null;

        form.innerHTML = "";
        form.appendChild(renderFileSection());
        var file = state.file;
        if (isDropFile(file)) {
            var drops = Array.isArray(file.drops) ? file.drops : [];
            var list = el("div", { className: "gen-list" });
            drops.forEach(function (drop, i) {
                list.appendChild(drop && typeof drop === "object" ? renderDrop(drop, i, drops.length) : el("p", null, ["Drop " + (i + 1) + " is not an object."]));
            });
            form.appendChild(section("Drops", [
                list,
                el("div", { className: "gen-row" }, [button("Add item drop", "add-drop", { value: "item" }), button("Add experience drop", "add-drop", { value: "experience" }, "gen-button--quiet")])
            ]));
        } else {
            var removals = Array.isArray(file.removals) ? file.removals : [];
            var rlist = el("div", { className: "gen-list" });
            removals.forEach(function (entry, i) {
                rlist.appendChild(renderRemoval(entry, i));
            });
            form.appendChild(section("Removals", [
                el("p", { className: "gen-help" }, ["Removes drops of the loot table, other mods and other namespaces' drop files, never of this file's own namespace."]),
                rlist,
                el("div", { className: "gen-row" }, [button("Add removal", "add-removal")])
            ]));
        }

        if (focusKey) {
            var again = form.querySelector('[data-path="' + focusKey + '"], [data-meta="' + focusKey + '"]');
            if (again) {
                again.focus();
                if (selStart !== null) {
                    try {
                        again.setSelectionRange(selStart, selStart);
                    } catch (e) {
                        /* number inputs have no selection */
                    }
                }
            }
        }
        renderOutput();
    }

    function safeSelection(input) {
        try {
            return input.selectionStart;
        } catch (e) {
            return null;
        }
    }

    /* ======================================================================
     * Output panel
     * ==================================================================== */

    function filePath() {
        return "data/" + (state.namespace || "mypack") + "/" + folderOf(state.kind) + "/" + (state.name || "drops") + ".json";
    }

    function fileText() {
        return JSON.stringify(state.file, null, 2) + "\n";
    }

    function simulateCommands() {
        var file = state.file;
        var target = file[targetKey(state.kind)];
        if (typeof target !== "string" || target === "*" || target.charAt(0) === "#" || /:\*$/.test(target) || !TARGET_RE.test(target)) {
            return { commands: [], note: "Simulating needs one " + (state.kind === "block" ? "block" : "mob") + " id: the file targets " + (target || "nothing") + "." };
        }
        var id = expandId(target);
        if (state.kind === "block") return { commands: ["/alkdrops simulate block " + id + " 1000"], note: "" };
        var triggers = [];
        if (isDropFile(file)) {
            (file.drops || []).forEach(function (drop) {
                var t = (drop && drop.on) || "death";
                if (triggers.indexOf(t) === -1 && TRIGGERS.indexOf(t) !== -1) triggers.push(t);
            });
        } else {
            triggers.push(file.on || "death");
        }
        if (!triggers.length) triggers.push("death");
        return {
            commands: triggers.map(function (t) {
                return simulateFor(id, t);
            }),
            note: ""
        };
    }

    function simulateFor(id, trigger) {
        if (state.kind === "block") return "/alkdrops simulate block " + id + " 1000";
        if (trigger === "death") return "/alkdrops simulate entity " + id + " 1000";
        if (trigger === "periodic") return "/alkdrops simulate entity " + id + " on periodic 72000";
        return "/alkdrops simulate entity " + id + " on " + trigger + " 1000";
    }

    function renderOutput() {
        refreshPreviews();
        var issues = checkFile(state.kind, state.file);
        var errors = issues.filter(function (i) {
            return i.severity === "error";
        }).length;
        var warnings = issues.length - errors;
        Object.keys(rawErrors).forEach(function (key) {
            issues.unshift(issue("error", key.replace(/^file\./, ""), "this JSON box does not parse yet: " + rawErrors[key]));
        });
        if (Object.keys(rawErrors).length) errors += Object.keys(rawErrors).length;

        var nameProblem = !NAME_RE.test(state.name || "") || !/^[a-z0-9_.-]+$/.test(state.namespace || "");

        output.innerHTML = "";
        var status = el("p", { className: "gen-status " + (errors ? "is-error" : warnings ? "is-warning" : "is-ok") }, [
            errors ? errors + " error(s)" + (warnings ? ", " + warnings + " warning(s)" : "") : warnings ? warnings + " warning(s)" : "No problems found"
        ]);
        var code = el("code", { "data-lang": "json" });
        code.textContent = fileText();
        site.highlightCode(code);
        var pre = el("pre", { className: "gen-code" }, [code]);

        var actions = el("div", { className: "gen-actions" }, [
            button("Copy JSON", "copy-json"),
            button("Download .json", "download-json", null, "gen-button--quiet"),
            button("Download datapack .zip", "download-zip", null, "gen-button--quiet"),
            button("Copy share link", "share", null, "gen-button--quiet"),
            button("Import a file", "open-import", null, "gen-button--quiet")
        ]);

        var issueList = el("ul", { className: "gen-issues" });
        issues.forEach(function (item) {
            issueList.appendChild(el("li", { className: "gen-issue gen-issue--" + item.severity }, [
                el("span", { className: "gen-issue__path" }, [item.path || "file"]),
                el("span", null, [item.message])
            ]));
        });
        if (nameProblem) {
            issueList.appendChild(el("li", { className: "gen-issue gen-issue--error" }, [
                el("span", { className: "gen-issue__path" }, ["path"]),
                el("span", null, ["namespace and file name: lowercase letters, digits and _ . - only (and / for subfolders)"])
            ]));
        }

        var sim = simulateCommands();
        var simBlock = el("div", { className: "gen-simulate" }, [el("p", { className: "gen-output__label" }, ["Test it in game"])]);
        simBlock.appendChild(el("p", { className: "gen-help" }, ["/reload, then /alkdrops validate " + (state.namespace || "mypack")]));
        sim.commands.forEach(function (command) {
            var c = el("code", { "data-lang": "command" });
            c.textContent = command;
            site.highlightCode(c);
            simBlock.appendChild(el("div", { className: "gen-command" }, [c, button("Copy", "copy-text", { text: command }, "gen-chip")]));
        });
        if (sim.note) simBlock.appendChild(el("p", { className: "gen-help" }, [sim.note]));

        output.appendChild(el("div", { className: "gen-output__head" }, [
            el("p", { className: "gen-output__label" }, ["Output"]),
            el("code", { className: "gen-path" }, [filePath()])
        ]));
        output.appendChild(status);
        output.appendChild(actions);
        output.appendChild(pre);
        if (issues.length || nameProblem) output.appendChild(issueList);
        output.appendChild(el("p", { className: "gen-help" }, [
            "These checks know vanilla ids only. /alkdrops validate in game is the final word (modded ids, your datapack functions, server limits)."
        ]));
        output.appendChild(simBlock);

        saveToHash();
    }

    /* ======================================================================
     * Events
     * ==================================================================== */

    function readInput(input) {
        var numKind = input.getAttribute("data-num");
        var raw = input.value;
        if (input.getAttribute("data-bool")) return input.checked ? true : undefined;
        if (numKind) {
            if (raw.trim() === "") return undefined;
            var n = Number(raw);
            if (isNaN(n)) return undefined;
            if (numKind === "percent") return Math.round(n * 1e6) / 1e8;
            return n;
        }
        if (raw === "" && (input.tagName === "INPUT" || input.getAttribute("data-empty") === "delete")) return undefined;
        return raw;
    }

    function applyInput(input) {
        var meta = input.getAttribute("data-meta");
        if (meta) {
            state[meta] = input.value.trim();
            return;
        }
        var key = input.getAttribute("data-path");
        if (!key) return;
        var path = parsePath(key);
        if (path[0] === "meta") return;

        if (input.getAttribute("data-json")) {
            var text = input.value;
            if (text.trim() === "") {
                delete rawText[key];
                delete rawErrors[key];
                deleteAt(state, path);
                return;
            }
            try {
                var value = JSON.parse(text);
                if (!Array.isArray(value)) throw new Error("must be a [ ] list");
                setAt(state, path, value);
                delete rawErrors[key];
                rawText[key] = text;
            } catch (e) {
                rawText[key] = text;
                rawErrors[key] = e.message;
            }
            return;
        }

        var v = readInput(input);
        if (v === undefined) deleteAt(state, path);
        else setAt(state, path, v);
    }

    form.addEventListener("input", function (event) {
        var input = event.target;
        if (input.tagName === "SELECT" || input.type === "checkbox") return;
        applyInput(input);
        if (input.getAttribute("data-rerender")) render();
        else renderOutput();
    });

    form.addEventListener("change", function (event) {
        var input = event.target;
        var action = input.getAttribute("data-action-change");
        if (action) {
            changeActions[action](input);
            render();
            return;
        }
        if (input.tagName === "SELECT" || input.type === "checkbox") {
            applyInput(input);
            render();
            return;
        }
        if (input.getAttribute("data-json")) {
            var key = input.getAttribute("data-path");
            if (!rawErrors[key]) delete rawText[key];
            render();
        }
    });

    var changeActions = {
        "set-what": function (input) {
            var drop = state.file.drops[parseInt(input.getAttribute("data-index"), 10)];
            if (input.value === "experience") {
                delete drop.item;
                drop.experience = true;
                delete drop.nbt;
                delete drop.functions;
                delete drop.on_drop;
                delete drop.per_player;
            } else {
                delete drop.experience;
                drop.item = drop.item || "minecraft:diamond";
            }
        },
        "set-removal-mode": function (input) {
            var i = parseInt(input.getAttribute("data-index"), 10);
            var old = state.file.removals[i];
            var oldItem = typeof old === "string" ? old : old && old.item;
            var item = oldItem && oldItem !== "*" && oldItem.charAt(0) !== "#" ? oldItem : "minecraft:rotten_flesh";
            var next = {
                item: item,
                tag: "#minecraft:wool",
                all: "*",
                experience: { experience: true },
                conditional: { item: item, conditions: [{ condition: "minecraft:killed_by_player" }] }
            }[input.value];
            if (input.value === "tag" && typeof oldItem === "string" && oldItem.charAt(0) === "#") next = oldItem;
            state.file.removals[i] = next;
            clearRaw("file.removals." + i);
        }
    };

    function clearRaw(prefix) {
        Object.keys(rawText).forEach(function (key) {
            if (key.indexOf(prefix) === 0) {
                delete rawText[key];
                delete rawErrors[key];
            }
        });
    }

    var clickActions = {
        "set-kind": function (btn) {
            var kind = btn.getAttribute("data-value");
            if (kind === state.kind) return;
            var file = state.file;
            var oldKey = targetKey(state.kind);
            var value = file[oldKey];
            delete file[oldKey];
            state.kind = kind;
            var fresh = { version: file.version };
            fresh[targetKey(kind)] = kind === "block" ? "minecraft:stone" : "minecraft:zombie";
            Object.keys(file).forEach(function (k) {
                if (k !== "version") fresh[k] = file[k];
            });
            if (value && (value === "*" || /:\*$/.test(value))) fresh[targetKey(kind)] = value;
            if (kind === "block") {
                delete fresh.on;
                (fresh.drops || []).forEach(function (drop) {
                    if (!drop) return;
                    delete drop.on;
                    delete drop.interval;
                    delete drop.cooldown;
                    delete drop.per_player;
                    if (drop.first_kill !== undefined) {
                        drop.first_break = drop.first_kill;
                        delete drop.first_kill;
                    }
                    if (drop.drop_behavior && (drop.drop_behavior.type === "max_health" || drop.drop_behavior.type === "damage_taken")) drop.drop_behavior.type = "hardness";
                });
            } else {
                (fresh.drops || []).forEach(function (drop) {
                    if (!drop) return;
                    if (drop.first_break !== undefined) {
                        drop.first_kill = drop.first_break;
                        delete drop.first_break;
                    }
                    if (drop.drop_behavior && drop.drop_behavior.type === "hardness") drop.drop_behavior.type = "max_health";
                });
            }
            state.file = fresh;
            rawText = {};
            rawErrors = {};
        },
        "set-type": function (btn) {
            var type = btn.getAttribute("data-value");
            var file = state.file;
            if (type === "drops" && !isDropFile(file)) {
                delete file.removals;
                delete file.on;
                file.drops = [newDrop(false)];
            } else if (type === "removals" && isDropFile(file)) {
                delete file.drops;
                file.removals = ["minecraft:rotten_flesh"];
            }
            rawText = {};
            rawErrors = {};
        },
        "add-drop": function (btn) {
            if (!Array.isArray(state.file.drops)) state.file.drops = [];
            state.file.drops.push(newDrop(btn.getAttribute("data-value") === "experience"));
        },
        "add-removal": function () {
            if (!Array.isArray(state.file.removals)) state.file.removals = [];
            state.file.removals.push("minecraft:rotten_flesh");
        },
        "remove-item": function (btn) {
            var key = btn.getAttribute("data-target");
            deleteAt(state, parsePath(key));
            var path = parsePath(key);
            var parent = getAt(state, path.slice(0, -1));
            if (Array.isArray(parent) && parent.length === 0 && path[path.length - 2] === "enchant_bonus") deleteAt(state, path.slice(0, -1));
            rawText = {};
            rawErrors = {};
        },
        duplicate: function (btn) {
            var i = parseInt(btn.getAttribute("data-index"), 10);
            var copy = clone(state.file.drops[i]);
            delete copy.id;
            state.file.drops.splice(i + 1, 0, copy);
            rawText = {};
            rawErrors = {};
        },
        move: function (btn) {
            var i = parseInt(btn.getAttribute("data-index"), 10);
            var j = i + parseInt(btn.getAttribute("data-dir"), 10);
            var drops = state.file.drops;
            var tmp = drops[i];
            drops[i] = drops[j];
            drops[j] = tmp;
            rawText = {};
            rawErrors = {};
        },
        "add-enchant": function (btn) {
            var drop = state.file.drops[parseInt(btn.getAttribute("data-index"), 10)];
            if (!Array.isArray(drop.enchant_bonus)) drop.enchant_bonus = [];
            var enchant = btn.getAttribute("data-enchant");
            drop.enchant_bonus.push({ enchant: enchant || "minecraft:sharpness", on_enchant: { bonus_chance: { bonus_chance_per_level: 0.01 } } });
        },
        "add-condition": function (btn) {
            var key = btn.getAttribute("data-target");
            var preset = CONDITION_PRESETS[state.kind][parseInt(btn.getAttribute("data-preset"), 10)][1];
            var list = getAt(state, parsePath(key));
            if (!Array.isArray(list)) {
                list = [];
                setAt(state, parsePath(key), list);
            }
            list.push(clone(preset));
            delete rawText[key];
            delete rawErrors[key];
        },
        "add-function": function (btn) {
            var key = btn.getAttribute("data-target");
            var preset = FUNCTION_PRESETS[parseInt(btn.getAttribute("data-preset"), 10)][1];
            var list = getAt(state, parsePath(key));
            if (!Array.isArray(list)) {
                list = [];
                setAt(state, parsePath(key), list);
            }
            list.push(clone(preset));
            delete rawText[key];
            delete rawErrors[key];
        },
        simulate: function (btn) {
            var drop = state.file.drops[parseInt(btn.getAttribute("data-index"), 10)];
            var target = state.file[targetKey(state.kind)];
            if (typeof target !== "string" || target === "*" || target.charAt(0) === "#" || /:\*$/.test(target)) {
                flash(btn, "Needs one id");
                return false;
            }
            var command = simulateFor(expandId(target), (drop && drop.on) || "death");
            if (drop && drop.item) command += " only " + expandId(drop.item);
            else if (drop && drop.experience) command += " only experience";
            copyAndFlash(btn, command);
            return false;
        },
        "copy-json": function (btn) {
            copyAndFlash(btn, fileText());
            return false;
        },
        "copy-text": function (btn) {
            copyAndFlash(btn, btn.getAttribute("data-text"));
            return false;
        },
        "download-json": function () {
            download((state.name || "drops").split("/").pop() + ".json", new Blob([fileText()], { type: "application/json" }));
            return false;
        },
        "download-zip": function () {
            var mcmeta = JSON.stringify({ pack: { pack_format: PACK_FORMAT, description: (state.namespace || "mypack") + " drops (Alkahest Drops)" } }, null, 2) + "\n";
            var zip = makeZip([
                { name: "pack.mcmeta", text: mcmeta },
                { name: filePath(), text: fileText() }
            ]);
            download((state.namespace || "mypack") + "_drops.zip", new Blob([zip], { type: "application/zip" }));
            return false;
        },
        share: function (btn) {
            saveToHash();
            copyAndFlash(btn, window.location.href);
            return false;
        },
        "open-import": function () {
            openImport();
            return false;
        }
    };

    root.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-action]");
        if (!btn || !root.contains(btn)) return;
        var action = clickActions[btn.getAttribute("data-action")];
        if (!action) return;
        if (action(btn) !== false) render();
    });

    function flash(btn, text) {
        var old = btn.textContent;
        btn.textContent = text;
        btn.disabled = true;
        setTimeout(function () {
            btn.textContent = old;
            btn.disabled = false;
        }, 1400);
    }

    function copyAndFlash(btn, text) {
        var done = function () {
            flash(btn, "Copied");
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, function () {
                window.prompt("Copy:", text);
            });
        } else {
            window.prompt("Copy:", text);
        }
    }

    function download(name, blob) {
        var url = URL.createObjectURL(blob);
        var a = el("a", { href: url, download: name });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    /* ======================================================================
     * Zip (stored, no compression): pack.mcmeta + the file
     * ==================================================================== */

    var CRC_TABLE = (function () {
        var table = [];
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        var crc = 0xffffffff;
        for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
    }

    function makeZip(entries) {
        var encoder = new TextEncoder();
        var now = new Date();
        var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        var chunks = [];
        var central = [];
        var offset = 0;
        entries.forEach(function (entry) {
            var name = encoder.encode(entry.name);
            var data = encoder.encode(entry.text);
            var crc = crc32(data);
            var local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true);
            local.setUint16(8, 0, true);
            local.setUint16(10, dosTime, true);
            local.setUint16(12, dosDate, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, data.length, true);
            local.setUint32(22, data.length, true);
            local.setUint16(26, name.length, true);
            local.setUint16(28, 0, true);
            chunks.push(new Uint8Array(local.buffer), name, data);

            var head = new DataView(new ArrayBuffer(46));
            head.setUint32(0, 0x02014b50, true);
            head.setUint16(4, 20, true);
            head.setUint16(6, 20, true);
            head.setUint16(8, 0x0800, true);
            head.setUint16(10, 0, true);
            head.setUint16(12, dosTime, true);
            head.setUint16(14, dosDate, true);
            head.setUint32(16, crc, true);
            head.setUint32(20, data.length, true);
            head.setUint32(24, data.length, true);
            head.setUint16(28, name.length, true);
            head.setUint16(30, 0, true);
            head.setUint16(32, 0, true);
            head.setUint16(34, 0, true);
            head.setUint16(36, 0, true);
            head.setUint32(38, 0, true);
            head.setUint32(42, offset, true);
            central.push(new Uint8Array(head.buffer), name);
            offset += 30 + name.length + data.length;
        });
        var centralSize = central.reduce(function (sum, part) {
            return sum + part.length;
        }, 0);
        var end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, entries.length, true);
        end.setUint16(10, entries.length, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);
        var parts = chunks.concat(central, [new Uint8Array(end.buffer)]);
        var total = parts.reduce(function (sum, part) {
            return sum + part.length;
        }, 0);
        var out = new Uint8Array(total);
        var pos = 0;
        parts.forEach(function (part) {
            out.set(part, pos);
            pos += part.length;
        });
        return out;
    }

    /* ======================================================================
     * Share links (state in the URL hash) and import
     * ==================================================================== */

    function toBase64Url(text) {
        var bytes = new TextEncoder().encode(text);
        var binary = "";
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    function fromBase64Url(text) {
        var b64 = text.replace(/-/g, "+").replace(/_/g, "/");
        while (b64.length % 4) b64 += "=";
        var binary = atob(b64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }

    var hashTimer = null;
    function saveToHash() {
        clearTimeout(hashTimer);
        hashTimer = setTimeout(function () {
            var data = { k: state.kind, n: state.namespace, f: state.name, j: state.file };
            var hash = "#s=" + toBase64Url(JSON.stringify(data));
            if (window.history && window.history.replaceState) window.history.replaceState(null, "", hash);
        }, 250);
    }

    function loadFromHash() {
        var match = /[#&]s=([A-Za-z0-9_-]+)/.exec(window.location.hash);
        if (!match) return false;
        try {
            var data = JSON.parse(fromBase64Url(match[1]));
            if (!data || typeof data.j !== "object") return false;
            state = { kind: data.k === "block" ? "block" : "mob", namespace: data.n || "mypack", name: data.f || "drops", file: data.j };
            return true;
        } catch (e) {
            return false;
        }
    }

    var dialog = document.querySelector("[data-gen-import]");

    function openImport() {
        if (!dialog) return;
        dialog.querySelector("[data-import-text]").value = "";
        dialog.querySelector("[data-import-error]").textContent = "";
        if (dialog.showModal) dialog.showModal();
        else dialog.setAttribute("open", "");
    }

    function closeImport() {
        if (dialog.close) dialog.close();
        else dialog.removeAttribute("open");
    }

    function importText(text, fileName) {
        var error = dialog.querySelector("[data-import-error]");
        var json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            error.textContent = "Not valid JSON: " + e.message;
            return;
        }
        if (!json || typeof json !== "object" || Array.isArray(json)) {
            error.textContent = "A drop file is a JSON object.";
            return;
        }
        var choice = dialog.querySelector("[data-import-kind]").value;
        var kind = choice !== "auto" ? choice : json.block !== undefined ? "block" : "mob";
        state.kind = kind;
        state.file = json;
        if (fileName) state.name = fileName.replace(/\.json$/i, "").toLowerCase();
        rawText = {};
        rawErrors = {};
        closeImport();
        render();
    }

    if (dialog) {
        dialog.querySelector("[data-import-load]").addEventListener("click", function () {
            importText(dialog.querySelector("[data-import-text]").value, null);
        });
        dialog.querySelector("[data-import-cancel]").addEventListener("click", closeImport);
        dialog.querySelector("[data-import-file]").addEventListener("change", function (event) {
            var fileInput = event.target.files && event.target.files[0];
            if (!fileInput) return;
            var reader = new FileReader();
            reader.onload = function () {
                importText(String(reader.result), fileInput.name);
            };
            reader.readAsText(fileInput);
        });
    }

    /* ======================================================================
     * Recipes and start
     * ==================================================================== */

    var recipeSelect = document.querySelector("[data-gen-recipe]");
    if (recipeSelect) {
        Object.keys(RECIPES).forEach(function (key) {
            recipeSelect.appendChild(el("option", { value: key }, [RECIPES[key].label]));
        });
        var confirmDialog = document.querySelector("[data-gen-confirm]");
        var pendingRecipe = null;

        var applyRecipe = function (recipe) {
            state = recipe.make();
            rawText = {};
            rawErrors = {};
            render();
        };
        var closeConfirm = function () {
            pendingRecipe = null;
            recipeSelect.value = "";
            if (confirmDialog.open) {
                if (confirmDialog.close) confirmDialog.close();
                else confirmDialog.removeAttribute("open");
            }
            recipeSelect.focus();
        };

        recipeSelect.addEventListener("change", function () {
            var recipe = RECIPES[recipeSelect.value];
            if (!recipe) return;
            if (!confirmDialog) {
                applyRecipe(recipe);
                recipeSelect.value = "";
                return;
            }
            pendingRecipe = recipe;
            confirmDialog.querySelector("[data-confirm-text]").textContent =
                "Your current file will be replaced by “" + recipe.label + "”.";
            if (confirmDialog.showModal) confirmDialog.showModal();
            else confirmDialog.setAttribute("open", "");
            confirmDialog.querySelector("[data-confirm-yes]").focus();
        });

        if (confirmDialog) {
            confirmDialog.querySelector("[data-confirm-yes]").addEventListener("click", function () {
                var recipe = pendingRecipe;
                closeConfirm();
                if (recipe) applyRecipe(recipe);
            });
            confirmDialog.querySelector("[data-confirm-no]").addEventListener("click", closeConfirm);
            /* Escape closes a modal dialog by itself; keep the select in sync. */
            confirmDialog.addEventListener("close", function () {
                pendingRecipe = null;
                recipeSelect.value = "";
            });
        }
    }

    buildDatalists();
    loadFromHash();
    render();

    /* Exposed for tests: the checks and preview run without the page. */
    A.generator = { checkFile: checkFile, describeDrop: describeDrop, recipes: RECIPES, makeZip: makeZip };
})();
