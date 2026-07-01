import { describe, expect, it } from 'vitest';
import {
    getSettingsSkillsViewModel,
    getPersistedSkillSelection,
} from '../webview/settingsSkills';
import type { SettingsDiscoveredSkill } from '../webview/settingsSkills';

const skill = (name: string, description?: string, sourceLabel?: string): SettingsDiscoveredSkill => ({
    name,
    description,
    sourceLabel,
});

describe('getSettingsSkillsViewModel', () => {
    it('returns all discovered skills with no filter', () => {
        const discovered = [skill('react', 'React library'), skill('vue', 'Vue library')];
        const vm = getSettingsSkillsViewModel(discovered, []);
        expect(vm.filtered).toHaveLength(2);
        expect(vm.installedCount).toBe(2);
    });

    it('filters by name text (case insensitive)', () => {
        const discovered = [skill('react-hooks'), skill('vue-router'), skill('react-query')];
        const vm = getSettingsSkillsViewModel(discovered, [], 'REACT');
        expect(vm.filtered.map(s => s.name)).toEqual(['react-hooks', 'react-query']);
    });

    it('filters by description text', () => {
        const discovered = [skill('lib-a', 'Handles routing'), skill('lib-b', 'State management')];
        const vm = getSettingsSkillsViewModel(discovered, [], 'routing');
        expect(vm.filtered).toHaveLength(1);
        expect(vm.filtered[0].name).toBe('lib-a');
    });

    it('status filter active returns only selected skills', () => {
        const discovered = [skill('a'), skill('b'), skill('c')];
        const vm = getSettingsSkillsViewModel(discovered, ['a', 'c'], '', 'active');
        expect(vm.filtered.map(s => s.name)).toEqual(['a', 'c']);
    });

    it('status filter inactive returns only non-selected skills', () => {
        const discovered = [skill('a'), skill('b'), skill('c')];
        const vm = getSettingsSkillsViewModel(discovered, ['a'], '', 'inactive');
        expect(vm.filtered.map(s => s.name)).toEqual(['b', 'c']);
    });

    it('activeInstalledCount counts discovered skills that are selected', () => {
        const discovered = [skill('a'), skill('b'), skill('c')];
        const vm = getSettingsSkillsViewModel(discovered, ['a', 'b']);
        expect(vm.activeInstalledCount).toBe(2);
    });

    it('emptyMessage when no skills discovered', () => {
        const vm = getSettingsSkillsViewModel([], []);
        expect(vm.emptyMessage).toMatch(/no skills discovered/i);
    });

    it('emptyMessage when filter returns nothing', () => {
        const discovered = [skill('react')];
        const vm = getSettingsSkillsViewModel(discovered, [], 'nonexistent');
        expect(vm.emptyMessage).toMatch(/no skills match/i);
    });

    it('filters by source label as well as name and description', () => {
        const discovered = [skill('agentic-kanban', 'Workflow skill', '~/.agents/skills'), skill('astro', 'Astro skill', 'workspace/skills')];
        const vm = getSettingsSkillsViewModel(discovered, [], 'workspace/skills');
        expect(vm.filtered.map(s => s.name)).toEqual(['astro']);
    });
});

describe('getPersistedSkillSelection', () => {
    it('keeps only discovered skill names from selection', () => {
        const discovered = [skill('a'), skill('b')];
        const result = getPersistedSkillSelection(discovered, ['a', 'c']);
        expect(result).toEqual(['a']);
    });

    it('deduplicates selection', () => {
        const discovered = [skill('a')];
        const result = getPersistedSkillSelection(discovered, ['a', 'a']);
        expect(result).toEqual(['a']);
    });

    it('returns empty when no overlap', () => {
        const discovered = [skill('x')];
        const result = getPersistedSkillSelection(discovered, ['a', 'b']);
        expect(result).toEqual([]);
    });
});
