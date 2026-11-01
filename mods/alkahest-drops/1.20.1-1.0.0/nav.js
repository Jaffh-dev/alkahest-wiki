/*
 * Page list of Alkahest Drops 1.20.1-1.0.0. The sidebar, the previous / next links and the version selector read it.
 * Each id is the file name (without ".html") inside the section folder. Keywords only help the sidebar filter.
 */
window.Alkahest.registerNav("alkahest-drops", "1.20.1-1.0.0", {
    datapacks: [
        {
            title: "Start here",
            pages: [
                { id: "index", title: "Getting started", keywords: "pack.mcmeta folder first file reload download" },
                { id: "editor-support", title: "Editor autocomplete", keywords: "json schema vscode intellij" }
            ]
        },
        {
            title: "Generators",
            pages: [
                { id: "generator", title: "Drop file generator", keywords: "form builder tool zip export share import recipe" },
                { id: "simulate-generator", title: "Simulate command generator", keywords: "simulate command builder enchant tool" }
            ]
        },
        {
            title: "Writing files",
            pages: [
                { id: "drop-files", title: "Drop files", keywords: "item chance count drops keys reference" },
                { id: "removal-files", title: "Removal files", keywords: "removals namespace replace remove" },
                { id: "targets-and-conditions", title: "Targets and conditions", keywords: "tag mod:* * global local real player" },
                { id: "behaviors", title: "Drop behaviors", keywords: "uniform fixed_rolls chained_rolls max_health hardness damage_taken" },
                { id: "enchant-bonus", title: "Enchantment bonuses", keywords: "looting fortune enchant_bonus" },
                { id: "experience", title: "Experience drops", keywords: "xp orbs" },
                { id: "functions-and-nbt", title: "Loot functions and NBT", keywords: "functions nbt enchant_randomly furnace_smelt" }
            ]
        },
        {
            title: "More features",
            pages: [
                { id: "progress", title: "Pity, first drops, per player", keywords: "pity first_kill first_break per_player id" },
                { id: "triggers", title: "Triggers", keywords: "on shear hit lightning periodic interval cooldown" },
                { id: "on-drop", title: "Drop actions", keywords: "on_drop glow run_function" }
            ]
        },
        {
            title: "Testing",
            pages: [
                { id: "commands", title: "Commands", keywords: "alkdrops validate files sources drops simulate reset help" },
                { id: "validation", title: "Validation and limits", keywords: "errors warnings config max_count max_rolls" },
                { id: "jei", title: "JEI and multiplayer", keywords: "jei server client" }
            ]
        },
        {
            title: "Reference",
            pages: [
                { id: "recipes", title: "Recipes", keywords: "examples replace rare shear" },
                { id: "known-limits", title: "Known limits", keywords: "limits dispenser grave" }
            ]
        }
    ],
    developers: [
        {
            title: "Start here",
            pages: [
                { id: "index", title: "Overview", keywords: "api dependency" },
                { id: "drop-files-in-mods", title: "Drop files in your mod", keywords: "resources data no dependency" },
                { id: "setup", title: "Depending on the API", keywords: "gradle mods.toml optional compileOnly" }
            ]
        },
        {
            title: "API",
            pages: [
                { id: "events", title: "Events", keywords: "OnDropEvent DropFilesLoadedEvent" },
                { id: "read-api", title: "Read API", keywords: "getMobDrops getBlockDrops TargetDrops AddedDrop DropRemoval" },
                { id: "progress-api", title: "Progress API", keywords: "pity first drop reset" },
                { id: "stability", title: "Stability and stable ids", keywords: "semantic versioning since ids" }
            ]
        }
    ]
});
