import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { galleryExamples, filterExamples, getExamplesGallery, CATEGORIES } from './examplesGallery';

describe('examplesGallery data', () => {
    describe('data integrity', () => {
        it('has between 5 and 10 examples', () => {
            expect(galleryExamples.length).toBeGreaterThanOrEqual(5);
            expect(galleryExamples.length).toBeLessThanOrEqual(10);
        });

        it('all examples have required fields', () => {
            const requiredFields = ['id', 'name', 'description', 'category', 'tags', 'serviceCount', 'source', 'yaml'];
            for (const example of galleryExamples) {
                for (const field of requiredFields) {
                    expect(example[field], `${example.id} missing field: ${field}`).toBeDefined();
                }
            }
        });

        it('all example IDs are unique', () => {
            const ids = galleryExamples.map(e => e.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('all IDs follow kebab-case convention', () => {
            const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
            for (const example of galleryExamples) {
                expect(example.id).toMatch(kebabRegex);
            }
        });

        it('all YAML strings parse without fatal errors', () => {
            for (const example of galleryExamples) {
                const parsed = yaml.load(example.yaml);
                expect(parsed, `${example.id} YAML parse failed`).not.toBeNull();
                expect(parsed.services, `${example.id} has no services`).toBeDefined();
            }
        });

        it('serviceCount matches actual services in YAML', () => {
            for (const example of galleryExamples) {
                const parsed = yaml.load(example.yaml);
                const actualCount = Object.keys(parsed.services).length;
                expect(actualCount, `${example.id}: expected ${example.serviceCount} services, got ${actualCount}`).toBe(example.serviceCount);
            }
        });

        it('all category values are valid', () => {
            const validCategories = CATEGORIES.filter(c => c !== 'all');
            for (const example of galleryExamples) {
                expect(validCategories, `${example.id} has invalid category: ${example.category}`).toContain(example.category);
            }
        });

        it('all examples have 1-5 tags', () => {
            for (const example of galleryExamples) {
                expect(example.tags.length, `${example.id} has ${example.tags.length} tags`).toBeGreaterThanOrEqual(1);
                expect(example.tags.length, `${example.id} has ${example.tags.length} tags`).toBeLessThanOrEqual(5);
            }
        });

        it('all source URLs are valid awesome-compose links', () => {
            for (const example of galleryExamples) {
                expect(example.source).toMatch(/^https:\/\/github\.com\/docker\/awesome-compose/);
            }
        });
    });

    describe('filterExamples', () => {
        it('returns all examples when category is "all"', () => {
            const result = filterExamples(galleryExamples, 'all');
            expect(result).toEqual(galleryExamples);
        });

        it('returns correct subset for each category', () => {
            const categories = ['web', 'backend', 'fullstack', 'monitoring', 'database'];
            for (const cat of categories) {
                const result = filterExamples(galleryExamples, cat);
                for (const item of result) {
                    expect(item.category).toBe(cat);
                }
            }
        });

        it('returns empty array for non-existent category', () => {
            const result = filterExamples(galleryExamples, 'nonexistent');
            expect(result).toEqual([]);
        });

        it('does not mutate the original array', () => {
            const original = [...galleryExamples];
            filterExamples(galleryExamples, 'fullstack');
            expect(galleryExamples).toEqual(original);
        });

        it('preserves order within filtered results', () => {
            const fullstack = filterExamples(galleryExamples, 'fullstack');
            const fullstackFromOriginal = galleryExamples.filter(e => e.category === 'fullstack');
            expect(fullstack).toEqual(fullstackFromOriginal);
        });

        it('sum of all category counts equals total', () => {
            const categories = ['web', 'backend', 'fullstack', 'monitoring', 'database'];
            let sum = 0;
            for (const cat of categories) {
                sum += filterExamples(galleryExamples, cat).length;
            }
            expect(sum).toBe(galleryExamples.length);
        });
    });

    describe('getExamplesGallery', () => {
        it('returns all examples', () => {
            const result = getExamplesGallery();
            expect(result.length).toBe(galleryExamples.length);
        });

        it('returns sorted by category then name', () => {
            const result = getExamplesGallery();
            for (let i = 1; i < result.length; i++) {
                const prev = result[i - 1];
                const curr = result[i];
                const catCompare = prev.category.localeCompare(curr.category);
                if (catCompare === 0) {
                    expect(prev.name.localeCompare(curr.name)).toBeLessThanOrEqual(0);
                } else {
                    expect(catCompare).toBeLessThan(0);
                }
            }
        });

        it('does not mutate the original array', () => {
            const original = [...galleryExamples];
            getExamplesGallery();
            expect(galleryExamples).toEqual(original);
        });
    });
});
