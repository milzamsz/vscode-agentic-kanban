import { describe, expect, it } from 'vitest';
import { getSettingsModalRenderState } from '../webview/settingsModalState';

describe('getSettingsModalRenderState', () => {
    it('keeps the modal visible when it is open', () => {
        const state = getSettingsModalRenderState(true, 'board-config');

        expect(state.hidden).toBe(false);
        expect(state.boardConfigActive).toBe(true);
        expect(state.skillPacksActive).toBe(false);
    });

    it('marks the skill packs tab active when selected', () => {
        const state = getSettingsModalRenderState(true, 'skill-packs');

        expect(state.hidden).toBe(false);
        expect(state.boardConfigActive).toBe(false);
        expect(state.skillPacksActive).toBe(true);
        expect(state.boardConfigHidden).toBe(true);
        expect(state.skillPacksHidden).toBe(false);
    });

    it('hides the modal when it is closed', () => {
        const state = getSettingsModalRenderState(false, 'skill-packs');

        expect(state.hidden).toBe(true);
    });
});
