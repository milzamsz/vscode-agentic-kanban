import * as vscode from 'vscode';
import { parse, stringify } from 'yaml';
import * as os from 'os';
import * as path from 'path';
import type { StackPack } from './types';

const TEMPLATES_FILE = path.join(os.homedir(), '.agentkanban', 'templates.yaml');

export class StackTemplateStore {
    private get _uri(): vscode.Uri {
        return vscode.Uri.file(TEMPLATES_FILE);
    }

    async loadGlobalTemplates(): Promise<StackPack[]> {
        try {
            const bytes = await vscode.workspace.fs.readFile(this._uri);
            const text = new TextDecoder().decode(bytes);
            const parsed = parse(text);
            return Array.isArray(parsed?.templates) ? (parsed.templates as StackPack[]) : [];
        } catch {
            return [];
        }
    }

    async saveGlobalTemplates(templates: StackPack[]): Promise<void> {
        const dir = vscode.Uri.file(path.dirname(TEMPLATES_FILE));
        try {
            await vscode.workspace.fs.createDirectory(dir);
        } catch {
            // directory already exists
        }
        const text = stringify({ templates });
        await vscode.workspace.fs.writeFile(this._uri, new TextEncoder().encode(text));
    }

    async upsertGlobalTemplate(t: StackPack): Promise<void> {
        const templates = await this.loadGlobalTemplates();
        const idx = templates.findIndex(e => e.name === t.name);
        if (idx >= 0) {
            templates[idx] = t;
        } else {
            templates.push(t);
        }
        await this.saveGlobalTemplates(templates);
    }

    async deleteGlobalTemplate(name: string): Promise<void> {
        const templates = await this.loadGlobalTemplates();
        await this.saveGlobalTemplates(templates.filter(e => e.name !== name));
    }
}
