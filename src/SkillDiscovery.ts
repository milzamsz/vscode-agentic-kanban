import * as vscode from 'vscode';
import { ProjectSkillService, type DiscoveredSkill } from './ProjectSkillService';

export type { DiscoveredSkill } from './ProjectSkillService';

export async function discoverSkills(
    workspaceUri: vscode.Uri,
    extraDirs: string[] = [],
): Promise<DiscoveredSkill[]> {
    return new ProjectSkillService().discoverSkills(workspaceUri, extraDirs);
}
