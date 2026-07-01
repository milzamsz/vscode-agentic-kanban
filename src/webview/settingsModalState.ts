export type SettingsModalTab = 'board-config' | 'skill-packs';

export interface SettingsModalRenderState {
    hidden: boolean;
    boardConfigActive: boolean;
    skillPacksActive: boolean;
    boardConfigHidden: boolean;
    skillPacksHidden: boolean;
}

export function getSettingsModalRenderState(
    isOpen: boolean,
    activeTab: SettingsModalTab = 'board-config',
): SettingsModalRenderState {
    const skillPacksActive = activeTab === 'skill-packs';
    return {
        hidden: !isOpen,
        boardConfigActive: !skillPacksActive,
        skillPacksActive,
        boardConfigHidden: skillPacksActive,
        skillPacksHidden: !skillPacksActive,
    };
}
