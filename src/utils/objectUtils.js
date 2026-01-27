/**
 * Deep equality comparison with fast-path optimizations.
 * Handles primitives, objects, arrays, and nested structures.
 * 
 * @param {*} a - First value to compare
 * @param {*} b - Second value to compare
 * @returns {boolean} - True if values are deeply equal
 */
export function deepEqual(a, b) {
    // Fast path: identical references
    if (a === b) return true;

    // Fast path: different types
    if (typeof a !== typeof b) return false;

    // Fast path: primitives and null
    if (a == null || b == null) return a === b;

    // Handle NaN (NaN !== NaN in JavaScript) - must check before primitive comparison
    if (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b)) return true;

    if (typeof a !== 'object') return a === b;

    // Arrays
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        return a.every((val, i) => deepEqual(val, b[i]));
    }

    // Arrays vs objects
    if (Array.isArray(b)) return false;

    // Objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => deepEqual(a[key], b[key]));
}

/**
 * Merges React Flow elements (nodes or edges) using ID-based matching.
 * Preserves object references for unchanged elements to prevent unnecessary re-renders.
 * 
 * This function solves the problem of position-based array comparison which fails
 * when React Flow elements are reordered.
 * 
 * @param {Array} prevElements - Previous array of elements
 * @param {Array} newElements - New array of elements
 * @returns {Array} - Merged array with preserved references where possible
 */
export function mergeFlowElements(prevElements, newElements) {
    // Early exit: identical references
    if (prevElements === newElements) return prevElements;

    // Early exit: different lengths means changes exist
    if (prevElements.length !== newElements.length) return newElements;

    // Create ID-based map for O(1) lookup
    const prevMap = new Map(prevElements.map(el => [el.id, el]));

    let hasChanges = false;
    let hasReordering = false;

    const merged = newElements.map((newEl, index) => {
        const prevEl = prevMap.get(newEl.id);

        // Check for reordering - if ID at this position differs from prevElements
        if (prevElements[index]?.id !== newEl.id) {
            hasReordering = true;
        }

        // New element - not in previous array
        if (!prevEl) {
            hasChanges = true;
            return newEl;
        }

        // Deep comparison - preserve reference if unchanged
        if (deepEqual(prevEl, newEl)) {
            return prevEl; // ✅ Preserve reference - prevents React re-render
        }

        // Element changed
        hasChanges = true;
        return newEl;
    });

    // Return merged array if there are changes OR reordering
    // Only return prevElements if both content and order are identical
    return (hasChanges || hasReordering) ? merged : prevElements;
}
