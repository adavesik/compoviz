import { describe, it, expect } from 'vitest';
import { parseCompose } from '../utils/composeParser.js';
import { generateGraphviz } from '../utils/graphviz.js';
import { galleryExamples, filterExamples, CATEGORIES } from './examplesGallery.js';

/**
 * Property-based tests for the Examples Gallery.
 * These verify formal correctness properties that must hold
 * for all inputs and all examples.
 */
describe('Examples Gallery - Correctness Properties', () => {
    /**
     * Property 1: Gallery completeness
     * ∀ entry ∈ galleryExamples: parseCompose(entry.yaml).compose !== null
     */
    it('PROPERTY: Every example produces non-null compose object', () => {
        for (const example of galleryExamples) {
            const result = parseCompose(example.yaml, {
                enableIncludes: false,
                enableExtends: true,
                enableVariables: true,
                enableProfiles: false
            });
            expect(result.compose, `Failed for ${example.id}`).not.toBeNull();
        }
    });

    /**
     * Property 2: Every example generates non-empty graphviz DOT
     * ∀ entry ∈ galleryExamples: generateGraphviz(parseCompose(entry.yaml).compose).length > 0
     */
    it('PROPERTY: Loading any example generates non-empty graphviz DOT', () => {
        for (const example of galleryExamples) {
            const result = parseCompose(example.yaml, {
                enableIncludes: false,
                enableExtends: true,
                enableVariables: true,
                enableProfiles: false
            });
            const dot = generateGraphviz(result.compose);
            expect(dot.length, `Failed for ${example.id}`).toBeGreaterThan(0);
        }
    });

    /**
     * Property 3: Category filter correctness
     * ∀ category, ∀ entry ∈ filterExamples(examples, category):
     *   entry.category === category ∨ category === 'all'
     * 
     * Additionally: filtering then counting equals sum of individual category counts
     */
    it('PROPERTY: Filtering then counting equals sum of category counts', () => {
        const validCategories = CATEGORIES.filter(c => c !== 'all');

        // Sum of all individual category filters should equal total
        let totalFromCategories = 0;
        for (const cat of validCategories) {
            const filtered = filterExamples(galleryExamples, cat);
            totalFromCategories += filtered.length;

            // Every item in filtered result must match the category
            for (const item of filtered) {
                expect(item.category, `Item ${item.id} doesn't match category ${cat}`).toBe(cat);
            }
        }

        // Sum should equal total
        expect(totalFromCategories).toBe(galleryExamples.length);

        // 'all' should return everything
        const allFiltered = filterExamples(galleryExamples, 'all');
        expect(allFiltered.length).toBe(galleryExamples.length);
    });

    /**
     * Property 4: Idempotent loading
     * loadExample(e) → state1; loadExample(e) → state2; state1 === state2
     */
    it('PROPERTY: Loading same example twice produces identical state', () => {
        for (const example of galleryExamples) {
            const opts = {
                enableIncludes: false,
                enableExtends: true,
                enableVariables: true,
                enableProfiles: false
            };

            const state1 = parseCompose(example.yaml, opts).compose;
            const state2 = parseCompose(example.yaml, opts).compose;

            expect(state1, `Not idempotent for ${example.id}`).toEqual(state2);
        }
    });

    /**
     * Property 5: Filter is a partition
     * The union of all category filters equals the full set,
     * and categories are disjoint (no item in two categories).
     */
    it('PROPERTY: Categories form a disjoint partition of all examples', () => {
        const validCategories = CATEGORIES.filter(c => c !== 'all');
        const seen = new Set();

        for (const cat of validCategories) {
            const filtered = filterExamples(galleryExamples, cat);
            for (const item of filtered) {
                expect(seen.has(item.id), `${item.id} appears in multiple categories`).toBe(false);
                seen.add(item.id);
            }
        }

        // All items should be accounted for
        expect(seen.size).toBe(galleryExamples.length);
    });

    /**
     * Property 6: Filter preserves order
     * ∀ category: filterExamples(examples, category) preserves relative order from original
     */
    it('PROPERTY: Filter preserves relative order from original array', () => {
        const validCategories = CATEGORIES.filter(c => c !== 'all');

        for (const cat of validCategories) {
            const filtered = filterExamples(galleryExamples, cat);
            if (filtered.length < 2) continue;

            for (let i = 0; i < filtered.length - 1; i++) {
                const idx1 = galleryExamples.indexOf(filtered[i]);
                const idx2 = galleryExamples.indexOf(filtered[i + 1]);
                expect(idx1, `Order not preserved for ${cat}`).toBeLessThan(idx2);
            }
        }
    });

    /**
     * Property 7: Non-mutating filter
     * filterExamples never modifies the input array
     */
    it('PROPERTY: filterExamples is non-mutating', () => {
        const originalLength = galleryExamples.length;
        const originalFirst = galleryExamples[0];

        // Run all possible filters
        for (const cat of CATEGORIES) {
            filterExamples(galleryExamples, cat);
        }

        expect(galleryExamples.length).toBe(originalLength);
        expect(galleryExamples[0]).toBe(originalFirst);
    });
});
