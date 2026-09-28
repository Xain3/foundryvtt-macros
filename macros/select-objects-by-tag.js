// Purpose: Select canvas objects by Tagger tags, with preview, set operations, and a second-run toggle.
// Authors: FoundryVTT Macros contributors
// License: MIT
// Version: 1.0.0
// Requirements: Foundry VTT V12+ and the Tagger module.
//
// Searches only the active canvas layer. Supports ANY/ALL tag matching,
// inclusion and exclusion filters, and Replace/Add/Remove selection operations.
// A scene-aware second-run toggle deselects matches left selected by the
// previous run without disturbing other selected objects.

const SELECT_BY_TAG = Object.freeze({
    FLAG_SCOPE: "world",
    FLAG_KEY: "select-objects-by-tag-state-v2"
});

/** Runs the tag search workflow and reports unexpected errors to Foundry.
 * @returns {Promise<void>}
 */
async function selectObjectsByTag() {
    try {
        if (!validateEnvironment()) return;

        const layer = canvas.activeLayer;

        // If this exact scene/layer still contains controlled matches from the
        // previous run, the current invocation acts as a toggle-off operation.
        if (await handlePreviousToggle(layer)) return;

        const availableTags = getAvailableTags(layer);
        const dialogContent = buildDialogHTML(layer.name, availableTags);

        let userInput;
        while (true) {
            userInput = await promptUserForInput(layer.name, dialogContent);
            if (!userInput) return;

            if (userInput.matchMode === "untagged" || userInput.tags.length > 0) {
                break;
            }

            ui.notifications.warn(
                "Select or enter at least one tag, or choose Untagged Only."
            );
        }

        if (!isOriginalContextActive(layer)) {
            ui.notifications.warn(
                "The active scene or layer changed while the selection window was open. No changes were made."
            );
            return;
        }

        const matchingObjects = getMatchingObjects(layer, userInput);
        const selectionData = calculateSelectionData(
            layer,
            matchingObjects,
            userInput.applyMode
        );

        if (
            selectionData.idsToControl.length === 0 &&
            selectionData.idsToRelease.length === 0
        ) {
            ui.notifications.info(
                `No selection changes are required on the ${layer.name}. ` +
                `The search matched ${matchingObjects.length} object(s).`
            );
            return;
        }

        const isConfirmed = await confirmSelection(
            layer.name,
            selectionData,
            userInput
        );
        if (!isConfirmed) return;

        if (!isOriginalContextActive(layer)) {
            ui.notifications.warn(
                "The active scene or layer changed before confirmation. No changes were made."
            );
            return;
        }

        if (!sameIdSet(selectionData.currentIds, getControlledIds(layer))) {
            ui.notifications.warn(
                "The current selection changed while the confirmation window was open. " +
                "Run the macro again to recalculate the result."
            );
            return;
        }

        await executeSelection(layer, selectionData, userInput);
    } catch (error) {
        console.error("Select Objects by Tag macro failed:", error);
        ui.notifications.error(
            "Select Objects by Tag encountered an unexpected error. See the console for details."
        );
    }
}

// ==========================================
// ENVIRONMENT, IDENTITY, AND SAVED STATE
// ==========================================

/** Checks that Tagger, the active canvas layer, and DialogV2 are available.
 * @returns {boolean} Whether the macro can safely start.
 */
function validateEnvironment() {
    if (!game.modules.get("tagger")?.active || !globalThis.Tagger?.getTags) {
        ui.notifications.error(
            "Tagger is unavailable. Enable the Tagger module before using this macro."
        );
        return false;
    }

    const layer = canvas.activeLayer;
    if (
        !canvas.ready ||
        !canvas.scene ||
        !layer ||
        !Array.isArray(layer.placeables) ||
        !Array.isArray(layer.controlled) ||
        typeof layer.get !== "function"
    ) {
        ui.notifications.warn(
            "Select a valid placeables layer on an active scene before using this macro."
        );
        return false;
    }

    if (!foundry.applications?.api?.DialogV2) {
        ui.notifications.error(
            "This macro requires Foundry VTT V12 or later (DialogV2)."
        );
        return false;
    }

    return true;
}

/** Builds the scene and layer identity stored with the second-run toggle.
 * @param {object} layer - Active canvas layer.
 * @returns {{sceneId: string|null, layerName: string, layerType: string}}
 */
function getLayerIdentity(layer) {
    return {
        sceneId: canvas.scene?.id ?? null,
        layerName: layer.name,
        layerType:
            layer.documentName ??
            layer.constructor?.documentName ??
            layer.constructor?.name ??
            "UnknownLayer"
    };
}

/** Returns whether saved toggle state belongs to the current scene and layer.
 * @param {object|null} state - Persisted toggle state.
 * @param {object} layer - Active canvas layer.
 * @returns {boolean}
 */
function stateMatchesLayer(state, layer) {
    if (!state || typeof state !== "object") return false;

    const identity = getLayerIdentity(layer);
    return (
        state.sceneId === identity.sceneId &&
        state.layerName === identity.layerName &&
        state.layerType === identity.layerType
    );
}

/** Prevents a dialog result from applying after the user changes canvas context.
 * @param {object} layer - Layer that was active when the workflow began.
 * @returns {boolean} Whether that layer is still active on a ready canvas.
 */
function isOriginalContextActive(layer) {
    return canvas.ready && canvas.scene && canvas.activeLayer === layer;
}

/** Removes this macro's saved second-run toggle from the current user.
 * @returns {Promise<void>}
 */
async function clearSavedState() {
    const existing = game.user.getFlag(
        SELECT_BY_TAG.FLAG_SCOPE,
        SELECT_BY_TAG.FLAG_KEY
    );

    if (existing !== undefined) {
        await game.user.unsetFlag(
            SELECT_BY_TAG.FLAG_SCOPE,
            SELECT_BY_TAG.FLAG_KEY
        );
    }
}

/** Deselects still-controlled matches from the prior run, if applicable.
 * Stale or mismatched state is cleared so the caller can start a new search.
 * @param {object} layer - Active canvas layer.
 * @returns {Promise<boolean>} Whether a previous result was toggled off.
 */
async function handlePreviousToggle(layer) {
    const state = game.user.getFlag(
        SELECT_BY_TAG.FLAG_SCOPE,
        SELECT_BY_TAG.FLAG_KEY
    );

    if (!state) return false;

    if (!stateMatchesLayer(state, layer) || !Array.isArray(state.matchedIds)) {
        await clearSavedState();
        return false;
    }

    const savedIds = new Set(state.matchedIds);
    const controlledMatches = layer.controlled.filter((placeable) =>
        savedIds.has(placeable.id)
    );

    // The saved result is stale: clear it and continue to the selection window.
    if (controlledMatches.length === 0) {
        await clearSavedState();
        return false;
    }

    let releasedCount = 0;
    for (const placeable of controlledMatches) {
        if (placeable.release()) releasedCount += 1;
    }

    await clearSavedState();

    const tagSummary = formatPlainTagSummary(state.tags);
    ui.notifications.info(
        `Previous tag-search matches deselected: ${releasedCount}` +
        `${tagSummary ? ` (${tagSummary})` : ""}. ` +
        "Other selected objects were left unchanged. " +
        "Run the macro again to start a new search."
    );

    return true;
}

/** Saves search metadata so a later run can toggle its matches off.
 * @param {object} layer - Layer containing the matching objects.
 * @param {string[]} matchedIds - Matches that remain controlled after the operation.
 * @param {{tags: string[], matchMode: string, tagLogic: string, applyMode: string}} userInput - Search criteria.
 * @returns {Promise<void>}
 */
async function saveToggleState(layer, matchedIds, userInput) {
    if (matchedIds.length === 0) {
        await clearSavedState();
        return;
    }

    const identity = getLayerIdentity(layer);
    await game.user.setFlag(
        SELECT_BY_TAG.FLAG_SCOPE,
        SELECT_BY_TAG.FLAG_KEY,
        {
            version: 2,
            ...identity,
            matchedIds,
            tags: userInput.tags,
            matchMode: userInput.matchMode,
            tagLogic: userInput.tagLogic,
            applyMode: userInput.applyMode
        }
    );
}

// ==========================================
// TAG COLLECTION AND SAFE HTML
// ==========================================

/** Reads a placeable's Tagger tags and normalizes every value to a string.
 * @param {object} placeable - Canvas placeable or its document.
 * @returns {string[]}
 */
function getObjectTags(placeable) {
    const tags = Tagger.getTags(placeable.document || placeable);
    return Array.isArray(tags) ? tags.map(String) : [];
}

/** Counts distinct tags per placeable and returns them in natural sort order.
 * @param {object} layer - Layer whose placeables should be scanned.
 * @returns {{tag: string, count: number}[]}
 */
function getAvailableTags(layer) {
    const counts = new Map();

    for (const placeable of layer.placeables) {
        for (const tag of new Set(getObjectTags(placeable))) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }

    return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
        (a, b) =>
            a.tag.localeCompare(b.tag, undefined, {
                sensitivity: "base",
                numeric: true
            })
    );
}

/** Escapes a value for safe insertion into generated dialog HTML.
 * @param {unknown} value - Value to escape.
 * @returns {string}
 */
function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/** Formats a short, unescaped tag summary for notification text.
 * @param {string[]} tags - Tag names to summarize.
 * @returns {string}
 */
function formatPlainTagSummary(tags) {
    if (!Array.isArray(tags) || tags.length === 0) return "";
    const visible = tags.slice(0, 3).join(", ");
    return tags.length > 3 ? `${visible}, +${tags.length - 3} more` : visible;
}

/** Formats tag names for HTML, escaping each name before joining them.
 * @param {string[]} tags - Tag names to format.
 * @returns {string}
 */
function formatHTMLTagSummary(tags) {
    if (!Array.isArray(tags) || tags.length === 0) return "None";
    return tags.map((tag) => escapeHTML(tag)).join(", ");
}

// ==========================================
// SELECTION WINDOW
// ==========================================

/** Builds the search form shown for the active layer.
 * @param {string} layerName - Name displayed in the form.
 * @param {{tag: string, count: number}[]} availableTags - Tags and per-object counts.
 * @returns {string} Dialog form HTML.
 */
function buildDialogHTML(layerName, availableTags) {
    const safeLayerName = escapeHTML(layerName);

    const tagRows = availableTags.length
        ? availableTags
              .map(({ tag, count }, index) => {
                  const safeTag = escapeHTML(tag);
                  return `
                    <div class="sbt-tag-option" style="display:flex; align-items:center; gap:0.35rem;">
                        <input
                            type="checkbox"
                            id="sbt-tag-${index}"
                            name="tags"
                            value="${safeTag}"
                        >
                        <label for="sbt-tag-${index}" style="flex:1;">
                            ${safeTag} <span style="opacity:0.7;">(${count})</span>
                        </label>
                    </div>
                `;
              })
              .join("")
        : '<p class="sbt-no-tags">No tags were found on this layer.</p>';

    return `
        <form class="sbt-form">
            <p>Find matching objects on <strong>${safeLayerName}</strong>.</p>

            <fieldset style="margin-bottom:0.75rem;">
                <legend><strong>Search criteria</strong></legend>

                <label for="sbt-match-mode">Object filter</label>
                <select id="sbt-match-mode" style="width:100%; margin-bottom:0.5rem;">
                    <option value="include">Include — objects matching the selected tags</option>
                    <option value="exclude-pure">Pure Exclude — all objects except tag matches</option>
                    <option value="exclude-tagged">Exclude within Tagged — tagged objects except tag matches</option>
                    <option value="untagged">Untagged Only — objects with no tags</option>
                </select>

                <label for="sbt-tag-logic">Tag matching</label>
                <select id="sbt-tag-logic" style="width:100%;">
                    <option value="any">Match ANY selected tag</option>
                    <option value="all">Match ALL selected tags</option>
                </select>
            </fieldset>

            <fieldset id="sbt-tag-controls" style="margin-bottom:0.75rem;">
                <legend><strong>Tags</strong></legend>

                <input
                    type="search"
                    id="sbt-tag-filter"
                    placeholder="Filter available tags"
                    autocomplete="off"
                    style="width:100%; margin-bottom:0.4rem;"
                >

                <div style="display:flex; gap:0.4rem; margin-bottom:0.4rem;">
                    <button type="button" data-action="select-visible-tags">
                        Select visible
                    </button>
                    <button type="button" data-action="clear-tags">
                        Clear
                    </button>
                </div>

                <div
                    id="sbt-tag-list"
                    style="max-height:220px; overflow-y:auto; border:1px solid #7a7971; padding:0.4rem; margin-bottom:0.5rem;"
                >
                    ${tagRows}
                </div>

                <label for="sbt-other-tags">Additional tags</label>
                <input
                    type="text"
                    id="sbt-other-tags"
                    placeholder="Comma-separated exact tag names"
                    autocomplete="off"
                    style="width:100%;"
                >
            </fieldset>

            <fieldset>
                <legend><strong>Apply result</strong></legend>
                <select id="sbt-apply-mode" style="width:100%;">
                    <option value="replace">Replace the current selection</option>
                    <option value="add">Add matches to the current selection</option>
                    <option value="remove">Remove matches from the current selection</option>
                </select>
                <p id="sbt-apply-help" style="margin:0.4rem 0 0; opacity:0.8;"></p>
            </fieldset>
        </form>
    `;
}

/** Connects filtering and selection controls.
 * @param {object} dialog - Rendered DialogV2 instance.
 * @returns {() => void} Removes the installed event listeners.
 */
function installDialogHandlers(dialog) {
    const root = dialog.element;
    const matchMode = root.querySelector("#sbt-match-mode");
    const tagLogic = root.querySelector("#sbt-tag-logic");
    const tagControls = root.querySelector("#sbt-tag-controls");
    const tagFilter = root.querySelector("#sbt-tag-filter");
    const tagList = root.querySelector("#sbt-tag-list");
    const otherTags = root.querySelector("#sbt-other-tags");
    const applyMode = root.querySelector("#sbt-apply-mode");
    const applyHelp = root.querySelector("#sbt-apply-help");

    const updateTagAvailability = () => {
        const disabled = matchMode.value === "untagged";
        tagLogic.disabled = disabled;
        tagControls.querySelectorAll("input, button").forEach((element) => {
            element.disabled = disabled;
        });
        tagControls.style.opacity = disabled ? "0.55" : "1";
    };

    const updateTagFilter = () => {
        const query = tagFilter.value.trim().toLocaleLowerCase();
        tagList.querySelectorAll(".sbt-tag-option").forEach((row) => {
            const label = row.querySelector("label")?.textContent ?? "";
            row.style.display = label.toLocaleLowerCase().includes(query)
                ? "flex"
                : "none";
        });
    };

    const updateApplyHelp = () => {
        const messages = {
            replace: "The final selection will contain only the search matches.",
            add: "Existing selected objects will be retained and matches will be added.",
            remove: "Only matching objects will be removed from the current selection."
        };
        applyHelp.textContent = messages[applyMode.value];
    };

    const onChange = (event) => {
        if (event.target === matchMode) updateTagAvailability();
        if (event.target === applyMode) updateApplyHelp();
    };

    const onInput = (event) => {
        if (event.target === tagFilter) updateTagFilter();
    };

    const onClick = (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button || button.disabled) return;

        if (button.dataset.action === "select-visible-tags") {
            tagList.querySelectorAll(".sbt-tag-option").forEach((row) => {
                if (row.style.display !== "none") {
                    row.querySelector('input[name="tags"]').checked = true;
                }
            });
        }

        if (button.dataset.action === "clear-tags") {
            tagList
                .querySelectorAll('input[name="tags"]')
                .forEach((input) => (input.checked = false));
            otherTags.value = "";
        }
    };

    // Delegated listeners survive rerenders of the dialog's form contents.
    root.addEventListener("change", onChange);
    root.addEventListener("input", onInput);
    root.addEventListener("click", onClick);

    updateTagAvailability();
    updateTagFilter();
    updateApplyHelp();

    return () => {
        root.removeEventListener("change", onChange);
        root.removeEventListener("input", onInput);
        root.removeEventListener("click", onClick);
    };
}

/** Opens the search dialog and returns its selected criteria, or null on cancel.
 * @param {string} layerName - Name used in the dialog title.
 * @param {string} content - Form HTML created by {@link buildDialogHTML}.
 * @returns {Promise<{tags: string[], matchMode: string, tagLogic: string, applyMode: string}|null>}
 */
async function promptUserForInput(layerName, content) {
    const DialogV2 = foundry.applications.api.DialogV2;
    let cleanupHandlers = null;

    try {
        return await DialogV2.wait({
            window: { title: `Select ${layerName} Objects` },
            content,
            rejectClose: false,
            render: (event, dialog) => {
                cleanupHandlers?.();
                cleanupHandlers = installDialogHandlers(dialog);
            },
            close: () => {
                cleanupHandlers?.();
                cleanupHandlers = null;
            },
            buttons: [
                {
                    action: "select",
                    label: "Preview Selection",
                    default: true,
                    callback: (event, button, dialog) => {
                        const root = dialog.element;
                        const matchMode = root.querySelector("#sbt-match-mode").value;
                        const tagLogic = root.querySelector("#sbt-tag-logic").value;
                        const applyMode = root.querySelector("#sbt-apply-mode").value;
                        const selectedTags = new Set();

                        if (matchMode !== "untagged") {
                            root
                                .querySelectorAll('input[name="tags"]:checked')
                                .forEach((input) => {
                                    const tag = input.value.trim();
                                    if (tag) selectedTags.add(tag);
                                });

                            const additionalTags = root
                                .querySelector("#sbt-other-tags")
                                .value.split(",");

                            for (const value of additionalTags) {
                                const tag = value.trim();
                                if (tag) selectedTags.add(tag);
                            }
                        }

                        return {
                            tags: Array.from(selectedTags),
                            matchMode,
                            tagLogic,
                            applyMode
                        };
                    }
                },
                {
                    action: "cancel",
                    label: "Cancel",
                    callback: () => null
                }
            ]
        });
    } finally {
        cleanupHandlers?.();
    }
}

// ==========================================
// MATCHING AND SET CALCULATION
// ==========================================

/** Filters placeables by tag criteria and the chosen include/exclude mode.
 * @param {object} layer - Layer to search.
 * @param {{tags: string[], matchMode: string, tagLogic: string}} userInput - Search criteria.
 * @returns {object[]} Matching placeables.
 */
function getMatchingObjects(layer, userInput) {
    const { tags: requestedTags, matchMode, tagLogic } = userInput;

    return layer.placeables.filter((placeable) => {
        const objectTags = getObjectTags(placeable);

        if (matchMode === "untagged") {
            return objectTags.length === 0;
        }

        const objectTagSet = new Set(objectTags);
        const tagPredicate =
            tagLogic === "all"
                ? requestedTags.every((tag) => objectTagSet.has(tag))
                : requestedTags.some((tag) => objectTagSet.has(tag));

        if (matchMode === "exclude-pure") {
            return !tagPredicate;
        }

        if (matchMode === "exclude-tagged") {
            return objectTags.length > 0 && !tagPredicate;
        }

        return tagPredicate;
    });
}

/** Returns the IDs of all currently controlled placeables on the layer.
 * @param {object} layer - Canvas layer to inspect.
 * @returns {string[]}
 */
function getControlledIds(layer) {
    return layer.controlled.map((placeable) => placeable.id);
}

/** Compares two ID arrays as sets, ignoring their order.
 * @param {string[]} leftIds - First set of IDs.
 * @param {string[]} rightIds - Second set of IDs.
 * @returns {boolean}
 */
function sameIdSet(leftIds, rightIds) {
    if (leftIds.length !== rightIds.length) return false;
    const right = new Set(rightIds);
    return leftIds.every((id) => right.has(id));
}

/** Calculates the desired selection and the IDs that must change to reach it.
 * @param {object} layer - Layer with the current selection.
 * @param {object[]} matchingObjects - Placeables returned by the search.
 * @param {string} applyMode - `replace`, `add`, or `remove`.
 * @returns {{currentIds: string[], matchingIds: string[], finalIds: string[], idsToControl: string[], idsToRelease: string[], retainedIds: string[]}}
 */
function calculateSelectionData(layer, matchingObjects, applyMode) {
    const currentIds = getControlledIds(layer);
    const matchingIds = matchingObjects.map((placeable) => placeable.id);
    const currentSet = new Set(currentIds);
    const matchingSet = new Set(matchingIds);
    let desiredSet;

    if (applyMode === "add") {
        desiredSet = new Set([...currentSet, ...matchingSet]);
    } else if (applyMode === "remove") {
        desiredSet = new Set(
            [...currentSet].filter((id) => !matchingSet.has(id))
        );
    } else {
        desiredSet = new Set(matchingSet);
    }

    const finalIds = [...desiredSet];
    const idsToControl = finalIds.filter((id) => !currentSet.has(id));
    const idsToRelease = currentIds.filter((id) => !desiredSet.has(id));
    const retainedIds = currentIds.filter((id) => desiredSet.has(id));

    return {
        currentIds,
        matchingIds,
        finalIds,
        idsToControl,
        idsToRelease,
        retainedIds
    };
}

// ==========================================
// CONFIRMATION AND EXECUTION
// ==========================================

/** Describes the search criteria as HTML for the confirmation dialog.
 * @param {{tags: string[], matchMode: string, tagLogic: string}} userInput - Search criteria.
 * @returns {string} HTML description with tag names escaped.
 */
function describeCriteria(userInput) {
    const tags = formatHTMLTagSummary(userInput.tags);
    const logic = userInput.tagLogic === "all" ? "ALL" : "ANY";

    if (userInput.matchMode === "untagged") {
        return "Objects with exactly 0 tags.";
    }

    if (userInput.matchMode === "exclude-pure") {
        return `Every object except those matching ${logic} of these tags: <em>${tags}</em>.`;
    }

    if (userInput.matchMode === "exclude-tagged") {
        return `Tagged objects except those matching ${logic} of these tags: <em>${tags}</em>.`;
    }

    return `Objects matching ${logic} of these tags: <em>${tags}</em>.`;
}

/** Returns the human-readable label for a selection operation.
 * @param {string} applyMode - `replace`, `add`, or `remove`.
 * @returns {string}
 */
function describeApplyMode(applyMode) {
    if (applyMode === "add") return "Add matches to the current selection";
    if (applyMode === "remove") return "Remove matches from the current selection";
    return "Replace the current selection";
}

/** Shows the proposed selection changes and resolves to the user's decision.
 * @param {string} layerName - Name of the layer being updated.
 * @param {object} selectionData - Search matches and planned selection changes.
 * @param {{tags: string[], matchMode: string, tagLogic: string, applyMode: string}} userInput - Search criteria.
 * @returns {Promise<boolean>} Whether the user confirmed the operation.
 */
async function confirmSelection(layerName, selectionData, userInput) {
    const DialogV2 = foundry.applications.api.DialogV2;
    const zeroMatchWarning =
        selectionData.matchingIds.length === 0
            ? `
                <p style="color:var(--color-text-dark-warning);">
                    <strong>No objects matched.</strong>
                    ${
                        userInput.applyMode === "replace"
                            ? "Continuing will leave the layer with no selected objects."
                            : "Only changes implied by the chosen set operation will be applied."
                    }
                </p>
              `
            : "";

    const confirmationContent = `
        <p><strong>Layer:</strong> ${escapeHTML(layerName)}</p>
        <p><strong>Criteria:</strong> ${describeCriteria(userInput)}</p>
        <p><strong>Operation:</strong> ${describeApplyMode(userInput.applyMode)}</p>

        <table style="width:100%; margin:0.75rem 0;">
            <tbody>
                <tr><th style="text-align:left;">Search matches</th><td>${selectionData.matchingIds.length}</td></tr>
                <tr><th style="text-align:left;">Newly selected</th><td>${selectionData.idsToControl.length}</td></tr>
                <tr><th style="text-align:left;">Deselected</th><td>${selectionData.idsToRelease.length}</td></tr>
                <tr><th style="text-align:left;">Retained</th><td>${selectionData.retainedIds.length}</td></tr>
                <tr><th style="text-align:left;">Expected final selection</th><td><strong>${selectionData.finalIds.length}</strong></td></tr>
            </tbody>
        </table>

        ${zeroMatchWarning}
        <p>Apply these changes?</p>
    `;

    return DialogV2.confirm({
        window: { title: "Confirm Tag Selection" },
        content: confirmationContent,
        rejectClose: false,
        modal: true
    });
}

/** Applies the selection changes, saves toggle state, and reports the outcome.
 * @param {object} layer - Layer whose placeables should be controlled or released.
 * @param {object} selectionData - Planned selection changes from {@link calculateSelectionData}.
 * @param {{tags: string[], matchMode: string, tagLogic: string, applyMode: string}} userInput - Search criteria.
 * @returns {Promise<void>}
 */
async function executeSelection(layer, selectionData, userInput) {
    let releasedCount = 0;
    let controlledCount = 0;
    const failedReleaseIds = [];
    const failedControlIds = [];

    for (const id of selectionData.idsToRelease) {
        const placeable = layer.get(id);
        if (!placeable?.controlled) continue;

        if (placeable.release()) releasedCount += 1;
        else failedReleaseIds.push(id);
    }

    for (const id of selectionData.idsToControl) {
        const placeable = layer.get(id);
        if (!placeable) {
            failedControlIds.push(id);
            continue;
        }

        if (placeable.control({ releaseOthers: false })) controlledCount += 1;
        else if (!placeable.controlled) failedControlIds.push(id);
    }

    const actualControlledIds = getControlledIds(layer);
    const actualControlledSet = new Set(actualControlledIds);

    // A following invocation only toggles objects matched by this run that are
    // actually left controlled. Remove operations therefore save no toggle.
    const toggleIds =
        userInput.applyMode === "remove"
            ? []
            : selectionData.matchingIds.filter((id) =>
                  actualControlledSet.has(id)
              );

    try {
        await saveToggleState(layer, toggleIds, userInput);
    } catch (error) {
        console.error("Unable to save Select Objects by Tag state:", error);
        ui.notifications.warn(
            "The selection was updated, but its second-run toggle state could not be saved."
        );
    }

    const failures = failedReleaseIds.length + failedControlIds.length;
    if (failures > 0) {
        ui.notifications.warn(
            `Selection partially updated on ${layer.name}: ` +
            `${actualControlledIds.length} selected, ${controlledCount} added, ` +
            `${releasedCount} removed, and ${failures} operation(s) could not be completed.`
        );
        return;
    }

    ui.notifications.info(
        `Selection updated on ${layer.name}: ${actualControlledIds.length} selected ` +
        `(${controlledCount} added, ${releasedCount} removed).`
    );
}

// Foundry executes this file as a macro, so start the workflow immediately.
selectObjectsByTag();