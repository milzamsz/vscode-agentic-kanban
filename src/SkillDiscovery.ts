import * as vscode from 'vscode';
import { parse } from 'yaml';
import * as os from 'os';
import * as path from 'path';

export interface DiscoveredSkill {
    name: string;
    description?: string;
    source: string;
}

/**
 * Discover installed skills from known skill directories.
 * 
 * Scans:
 * - ~/.agents/skills
 * - ~/.claude/skills
 * - ~/.codex/skills
 * - ~/.antigravity/skills
 * - workspace/.claude/skills
 * - workspace/skills
 * - Custom dirs from agentKanban.skillsDirs setting
 */
export async function discoverSkills(
    workspaceUri: vscode.Uri,
    extraDirs: string[] = []
): Promise<DiscoveredSkill[]> {
    const homeDir = os.homedir();
    const workspacePath = workspaceUri.fsPath;

    const dirs: string[] = [
        path.join(homeDir, '.agents', 'skills'),
        path.join(homeDir, '.claude', 'skills'),
        path.join(homeDir, '.codex', 'skills'),
        path.join(homeDir, '.antigravity', 'skills'),
        path.join(workspacePath, '.claude', 'skills'),
        path.join(workspacePath, 'skills'),
    ];

    // Add custom dirs (expand ~ and workspace-relative)
    for (const d of extraDirs) {
        let expanded = d;
        if (d.startsWith('~/')) {
            expanded = path.join(homeDir, d.slice(2));
        } else if (!path.isAbsolute(d)) {
            expanded = path.join(workspacePath, d);
        }
        dirs.push(expanded);
    }

    const skillsMap = new Map<string, DiscoveredSkill>();

    for (const dir of dirs) {
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                if (type !== vscode.FileType.Directory) {
                    continue;
                }
                if (name.startsWith('.') || name === '.system') {
                    continue;
                }
                // Dedupe by name - first source wins
                if (skillsMap.has(name)) {
                    continue;
                }

                let description: string | undefined;
                const skillMdPath = path.join(dir, name, 'SKILL.md');
                try {
                    const content = new TextDecoder().decode(
                        await vscode.workspace.fs.readFile(vscode.Uri.file(skillMdPath))
                    );
                    const fm = parseFrontmatter(content);
                    if (typeof fm.description === 'string') {
                        description = fm.description;
                    }
                } catch {
                    // SKILL.md not found or parse failed - use dir name only
                }

                skillsMap.set(name, { name, description, source: dir });
            }
        } catch {
            // Directory doesn't exist or not accessible - skip silently
        }
    }

    // Sort by name
    return Array.from(skillsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns empty object if no frontmatter found.
 */
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
    const fmText = lines.slice(1, endIdx).join('\n');
    try {
        return parse(fmText) as Record<string, unknown>;
    } catch {
        return {};
    }
}
