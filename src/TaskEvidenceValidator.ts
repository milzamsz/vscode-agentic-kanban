import type { Task, TaskEvidence, EvidenceEntry } from './types';

export interface EvidenceValidationResult {
    ok: boolean;
    missing: string[];
    failed: string[];
    warnings: string[];
}

export class TaskEvidenceValidator {
    static validate(task: Task, isStandard: boolean): EvidenceValidationResult {
        const missing: string[] = [];
        const failed: string[] = [];
        const warnings: string[] = [];

        const evidence = task.evidence;
        if (!evidence) {
            return { ok: false, missing: ['ALL'], failed: [], warnings: [] };
        }

        // Core required evidence based on profile
        const required: string[] = ['behavior'];
        if (isStandard) {
            required.push('lint', 'test', 'build');
        }

        // Check each required evidence type
        for (const key of required) {
            const entry = evidence[key as keyof TaskEvidence] as EvidenceEntry | undefined;
            if (!entry) {
                missing.push(key);
            } else if (!entry.ran) {
                // Evidence was not run — treat as failed, not just a warning.
                // Required evidence must actually be executed before DONE.
                failed.push(key);
            } else if (!entry.passed) {
                failed.push(key);
            }
        }

        // Spec-driven tasks require behavior evidence
        if (task.spec && (!evidence.behavior || !evidence.behavior.passed)) {
            if (!missing.includes('behavior') && !failed.includes('behavior')) {
                failed.push('behavior');
                warnings.push('Spec-driven task requires behavior evidence proving acceptance criteria are met');
            }
        }

        return {
            ok: missing.length === 0 && failed.length === 0,
            missing,
            failed,
            warnings,
        };
    }
}