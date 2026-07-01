import * as vscode from 'vscode';
import { parse } from 'yaml';
import * as os from 'os';
import * as path from 'path';
import { lstat, rm, symlink } from 'fs/promises';

export interface DiscoveredSkill {
    name: string;
    description?: string;
    source: string;
    sourceLabel: string;
    isActive: boolean;
    canDeactivate: boolean;
}

interface SkillCandidate {
    name: string;
    description?: string;
    source: string;
    sourceLabel: string;
    isActive: boolean;
    canDeactivate: boolean;
}

export interface ApplyProjectSkillsResult {
    linked: string[];
    unlinked: string[];
    protected: string[];
}

export class ProjectSkillService {
    async discoverSkills(
        workspaceUri: vscode.Uri,
        extraDirs: string[] = [],
    ): Promise<DiscoveredSkill[]> {
        const candidates = await this.collectCandidates(workspaceUri, extraDirs);
        return Array.from(candidates.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    async getActiveSkillNames(
        workspaceUri: vscode.Uri,
        extraDirs: string[] = [],
    ): Promise<string[]> {
        const skills = await this.discoverSkills(workspaceUri, extraDirs);
        return skills.filter((skill) => skill.isActive).map((skill) => skill.name);
    }

    async applySelection(
        workspaceUri: vscode.Uri,
        selectedNames: string[],
        extraDirs: string[] = [],
    ): Promise<ApplyProjectSkillsResult> {
        const skills = await this.discoverSkills(workspaceUri, extraDirs);
        const selected = new Set(selectedNames);
        const projectSkillsDir = path.join(workspaceUri.fsPath, '.agents', 'skills');
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(projectSkillsDir));

        const result: ApplyProjectSkillsResult = {
            linked: [],
            unlinked: [],
            protected: [],
        };

        for (const skill of skills) {
            const targetPath = path.join(projectSkillsDir, skill.name);
            if (selected.has(skill.name)) {
                if (skill.isActive) {
                    continue;
                }
                await symlink(skill.source, targetPath, 'junction');
                result.linked.push(skill.name);
                continue;
            }

            if (!skill.isActive) {
                continue;
            }

            const isCanonicalProjectSkill = path.normalize(skill.source) === path.normalize(targetPath);
            if (!isCanonicalProjectSkill || !skill.canDeactivate) {
                result.protected.push(skill.name);
                continue;
            }

            await rm(targetPath, { force: true, recursive: true });
            result.unlinked.push(skill.name);
        }

        return result;
    }

    private async collectCandidates(
        workspaceUri: vscode.Uri,
        extraDirs: string[],
    ): Promise<Map<string, SkillCandidate>> {
        const workspacePath = workspaceUri.fsPath;
        const homeDir = os.homedir();

        const roots = [
            { dir: path.join(workspacePath, '.agents', 'skills'), sourceLabel: 'project/.agents/skills', isActive: true, canDeactivateCheck: true },
            { dir: path.join(workspacePath, 'skills'), sourceLabel: 'project/skills', isActive: true, canDeactivateCheck: false },
            { dir: path.join(workspacePath, '.claude', 'skills'), sourceLabel: 'project/.claude/skills', isActive: true, canDeactivateCheck: false },
            { dir: path.join(homeDir, '.agents', 'skills'), sourceLabel: '~/.agents/skills', isActive: false, canDeactivateCheck: false },
            { dir: path.join(homeDir, '.claude', 'skills'), sourceLabel: '~/.claude/skills', isActive: false, canDeactivateCheck: false },
            { dir: path.join(homeDir, '.codex', 'skills'), sourceLabel: '~/.codex/skills', isActive: false, canDeactivateCheck: false },
            { dir: path.join(homeDir, '.antigravity', 'skills'), sourceLabel: '~/.antigravity/skills', isActive: false, canDeactivateCheck: false },
            ...extraDirs.map((dir) => ({
                dir: this.expandDir(dir, workspacePath, homeDir),
                sourceLabel: this.toSourceLabel(dir),
                isActive: false,
                canDeactivateCheck: false,
            })),
        ];

        const map = new Map<string, SkillCandidate>();
        for (const root of roots) {
            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(root.dir));
                for (const [name, type] of entries) {
                    if (type !== vscode.FileType.Directory || name.startsWith('.') || name === '.system') {
                        continue;
                    }
                    if (map.has(name)) {
                        continue;
                    }
                    const source = path.join(root.dir, name);
                    map.set(name, {
                        name,
                        description: await this.readDescription(source),
                        source,
                        sourceLabel: root.sourceLabel,
                        isActive: root.isActive,
                        canDeactivate: root.canDeactivateCheck ? await this.isLink(source) : false,
                    });
                }
            } catch {
                // Missing or unreadable roots are ignored.
            }
        }
        return map;
    }

    private expandDir(dir: string, workspacePath: string, homeDir: string): string {
        if (dir.startsWith('~/')) {
            return path.join(homeDir, dir.slice(2));
        }
        if (!path.isAbsolute(dir)) {
            return path.join(workspacePath, dir);
        }
        return dir;
    }

    private toSourceLabel(dir: string): string {
        if (dir.startsWith('~/')) {
            return dir.replace(/\\/g, '/');
        }
        return dir.replace(/\\/g, '/');
    }

    private async readDescription(skillDir: string): Promise<string | undefined> {
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(skillDir, 'SKILL.md')));
            const fm = parseFrontmatter(new TextDecoder().decode(bytes));
            return typeof fm.description === 'string' ? fm.description : undefined;
        } catch {
            return undefined;
        }
    }

    private async isLink(targetPath: string): Promise<boolean> {
        try {
            const stat = await lstat(targetPath);
            return stat.isSymbolicLink();
        } catch {
            return false;
        }
    }
}

function parseFrontmatter(content: string): Record<string, unknown> {
    const lines = content.split('\n');
    if (lines[0]?.trim() !== '---') {
        return {};
    }
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            endIdx = i;
            break;
        }
    }
    if (endIdx === -1) {
        return {};
    }
    try {
        return parse(lines.slice(1, endIdx).join('\n')) as Record<string, unknown>;
    } catch {
        return {};
    }
}
