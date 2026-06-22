import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mdx from '@astrojs/mdx';
import mermaid from 'astro-mermaid';

export default defineConfig({
  site: 'https://agentic-kanban.pages.dev',
  base: '/',
  vite: {
    ssr: {
      noExternal: ['zod'],
    },
  },
  integrations: [
    mermaid(),
    starlight({
      title: 'Agentic Kanban',
      logo: {
        src: './src/assets/logo.svg',
      },
      customCss: [
        './src/styles/custom.css',
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/milzamsz/vscode-agentic-kanban' },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'What is Agentic Kanban?', link: '/getting-started/what-is-agentic-kanban' },
            { label: 'Installation', link: '/getting-started/installation' },
            { label: 'Quick Start', link: '/getting-started/quick-start' },
          ],
        },
        {
          label: 'Using the Board',
          items: [
            { label: 'Workflow Profiles', link: '/guides/workflow-profiles' },
            { label: 'Lanes & Tasks', link: '/guides/lanes-and-tasks' },
            { label: 'Chat Commands', link: '/guides/chat-commands' },
            { label: 'Spec-Driven Development', link: '/guides/spec-driven-development' },
            { label: 'Dependencies & Sweeps', link: '/guides/dependencies-and-sweeps' },
            { label: 'Git Worktrees', link: '/guides/worktrees' },
            { label: 'Context Injection', link: '/guides/context-injection' },
          ],
        },
        {
          label: 'Configuration & Reference',
          items: [
            { label: 'Settings', link: '/reference/settings' },
            { label: 'Commands', link: '/reference/commands' },
            { label: 'Board Config', link: '/reference/board-config' },
            { label: 'Storage Layout', link: '/reference/storage-layout' },
          ],
        },
        {
          label: 'Contributing',
          items: [
            { label: 'Development Setup', link: '/contributing/development-setup' },
            { label: 'Build & Test', link: '/contributing/build-and-test' },
            { label: 'Architecture', link: '/contributing/architecture' },
            { label: 'Release Workflow', link: '/contributing/release' },
          ],
        },
      ],
    }),
    mdx(),
  ],
});
