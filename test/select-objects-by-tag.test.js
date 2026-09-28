import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const SOURCE_PATH = "../macros/select-objects-by-tag.js"; 

const macroSource = await readFile(
    new URL(SOURCE_PATH, import.meta.url),
    "utf8"
);

test("selectObjectsByTag selects matching objects and saves toggle state", async () => {
    let savedState;
    const layer = {
        name: "Tokens",
        documentName: "Token",
        placeables: [],
        controlled: [],
        get(id) {
            return this.placeables.find((placeable) => placeable.id === id);
        }
    };

    for (const [id, tags] of [["matching", ["target"]], ["other", ["other"]]]) {
        const placeable = {
            id,
            document: { id, tags },
            controlled: false,
            control() {
                this.controlled = true;
                layer.controlled.push(this);
                return true;
            },
            release() {
                this.controlled = false;
                layer.controlled = layer.controlled.filter(
                    (controlled) => controlled !== this
                );
                return true;
            }
        };
        layer.placeables.push(placeable);
    }

    const context = {
        Tagger: { getTags: (document) => document.tags },
        canvas: {
            ready: true,
            scene: { id: "scene-1" },
            activeLayer: layer
        },
        game: {
            modules: { get: () => ({ active: true }) },
            user: {
                getFlag: () => savedState,
                setFlag: async (scope, key, state) => {
                    savedState = state;
                },
                unsetFlag: async () => {
                    savedState = undefined;
                }
            }
        },
        foundry: {
            applications: {
                api: {
                    DialogV2: {
                        wait: async () => ({
                            tags: ["target"],
                            matchMode: "include",
                            tagLogic: "any",
                            applyMode: "replace"
                        }),
                        confirm: async () => true
                    }
                }
            }
        },
        ui: { notifications: { error() {}, info() {}, warn() {} } },
        console: { error() {} }
    };

    await runInNewContext(macroSource, context);

    assert.deepEqual(
        layer.controlled.map((placeable) => placeable.id),
        ["matching"]
    );
    assert.deepEqual(savedState.matchedIds, ["matching"]);
    assert.equal(savedState.sceneId, "scene-1");
});