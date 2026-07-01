export interface SettingsDiscoveredSkill {
    name: string;
    description?: string;
    source?: string;
    sourceLabel?: string;
    isActive?: boolean;
    canDeactivate?: boolean;
}

export type SettingsSkillStatusFilter = 'all' | 'active' | 'inactive';

export interface SettingsSkillsViewModel {
    installedCount: number;
    activeInstalledCount: number;
    filtered: SettingsDiscoveredSkill[];
    emptyMessage?: string;
}

function norm(value: string): string {
    return value.trim().toLowerCase();
}

export function getSettingsSkillsViewModel(
    discoveredSkills: SettingsDiscoveredSkill[],
    selectedSkills: Iterable<string>,
    filterText = '',
    statusFilter: SettingsSkillStatusFilter = 'all',
): SettingsSkillsViewModel {
    const selected = new Set(Array.from(selectedSkills));
    const installedCount = discoveredSkills.length;
    const activeInstalledCount = discoveredSkills.filter((skill) => selected.has(skill.name)).length;

    const filter = norm(filterText);
    const filtered = discoveredSkills.filter((skill) => {
        const isActive = selected.has(skill.name);
        if (statusFilter === 'active' && !isActive) {
            return false;
        }
        if (statusFilter === 'inactive' && isActive) {
            return false;
        }
        if (!filter) {
            return true;
        }
        const haystack = [
            skill.name,
            skill.description ?? '',
            skill.sourceLabel ?? '',
        ].map(norm);
        return haystack.some((value) => value.includes(filter));
    });

    let emptyMessage: string | undefined;
    if (installedCount === 0) {
        emptyMessage = 'No skills discovered on this machine yet.';
    } else if (filtered.length === 0) {
        emptyMessage = 'No skills match your search.';
    }

    return {
        installedCount,
        activeInstalledCount,
        filtered,
        emptyMessage,
    };
}

export function getPersistedSkillSelection(
    discoveredSkills: SettingsDiscoveredSkill[],
    selectedSkills: Iterable<string>,
): string[] {
    const discoveredNames = new Set(discoveredSkills.map((skill) => skill.name));
    return Array.from(new Set(Array.from(selectedSkills).filter((skill) => discoveredNames.has(skill))));
}
