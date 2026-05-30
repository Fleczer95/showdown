#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CrossPlatformFixer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.shellScripts = [
            'scripts/dev.sh',
            'scripts/ios-regression.sh',
            'e2e/maestro/scripts/setup-ios.sh',
            'e2e/maestro/scripts/update-baseline.sh',
            'e2e/maestro/scripts/run-maestro-regression.sh',
        ];
    }

    log(message, type = 'info') {
        const icons = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            start: '🚀',
            progress: '⏳',
        };
        console.log(`${icons[type]} ${message}`);
    }

    /**
     * Convert Windows line endings (\r\n) to Unix (\n)
     */
    async normalizeLineEndings(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            if (content !== normalizedContent) {
                await fs.writeFile(filePath, normalizedContent, 'utf8');
                return true; // File was modified
            }
            return false; // No changes needed
        } catch (error) {
            this.log(`Error processing ${filePath}: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Ensure script has proper shebang and executable permissions
     */
    async ensureExecutable(filePath) {
        try {
            // Ensure file has proper shebang for bash scripts
            const content = await fs.readFile(filePath, 'utf8');

            // Add shebang if missing
            if (!content.startsWith('#!/bin/bash') && !content.startsWith('#!/usr/bin/env node')) {
                const shebang = filePath.endsWith('.sh') ? '#!/bin/bash\n' : '#!/usr/bin/env node\n';
                await fs.writeFile(filePath, shebang + content, 'utf8');
                this.log(`Added shebang to ${filePath}`, 'success');
            }

            // Make executable (only works on Unix-like systems)
            if (process.platform !== 'win32') {
                try {
                    execSync(`chmod +x "${filePath}"`, { stdio: 'pipe' });
                } catch (error) {
                    // Ignore permission errors on systems that don't support chmod
                }
            }

            return true;
        } catch (error) {
            this.log(`Error making ${filePath} executable: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Add cross-platform shebang handling for Windows compatibility
     */
    async ensureCrossPlatformShebang(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');

            // For Windows compatibility, ensure proper shebang
            if (filePath.endsWith('.sh')) {
                let updatedContent = content;

                // Replace any existing shebang with standard bash shebang
                updatedContent = updatedContent.replace(/^#!.*$/m, '#!/bin/bash');

                // Ensure script sets -e to exit on error for consistency
                if (!updatedContent.includes('set -e')) {
                    const shebangLine = '#!/bin/bash\n';
                    const restOfContent = updatedContent.replace(/^#!.*$/m, '').trimStart();
                    updatedContent = shebangLine + 'set -e\n\n' + restOfContent;
                }

                if (content !== updatedContent) {
                    await fs.writeFile(filePath, updatedContent, 'utf8');
                    return true;
                }
            }

            return false;
        } catch (error) {
            this.log(`Error updating shebang for ${filePath}: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Fix common cross-platform issues in shell scripts
     */
    async fixCrossPlatformIssues(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            let updatedContent = content;

            // Fix platform-specific commands
            if (filePath.endsWith('.sh')) {
                // Replace 'which' with 'command -v' for better cross-platform support
                updatedContent = updatedContent.replace(/\bwhich\s+/g, 'command -v ');

                // Fix path separators for cross-platform compatibility
                updatedContent = updatedContent.replace(/\/[^\/\s]+\/[^\/\s]+\/[^\/\s]+\/adb/g, (match) => {
                    // Keep the original path but ensure it's compatible
                    return match;
                });

                // Add error handling for missing commands
                updatedContent = updatedContent.replace(
                    /^(command -v \w+)(.*)$/gm,
                    'if $1 >/dev/null 2>&1; then\n    $1$2\nelse\n    echo "❌ Required command not found: $1"\n    exit 1\nfi',
                );

                // Ensure proper quoting of variables
                updatedContent = updatedContent.replace(/\$([A-Z_]+)/g, '${$1}');
            }

            if (content !== updatedContent) {
                await fs.writeFile(filePath, updatedContent, 'utf8');
                return true;
            }

            return false;
        } catch (error) {
            this.log(`Error fixing cross-platform issues for ${filePath}: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Find all shell scripts in the project
     */
    async findAllShellScripts() {
        const shellScripts = [];

        const findFiles = async (dir, extensions) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        // Skip node_modules and other large directories
                        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
                            await findFiles(fullPath, extensions);
                        }
                    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
                        shellScripts.push(fullPath);
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };

        await findFiles(this.projectRoot, ['.sh', '.bash']);
        return shellScripts;
    }

    /**
     * Fix all shell scripts for cross-platform compatibility
     */
    async fixAllScripts() {
        this.log('🔧 Starting Cross-Platform Script Fixes...', 'start');
        this.log('==========================================', 'info');

        // Use predefined list for now to avoid scanning too many files
        const scriptsToFix = this.shellScripts;

        let fixedCount = 0;
        let totalFiles = 0;

        for (const scriptPath of scriptsToFix) {
            const fullPath = path.join(this.projectRoot, scriptPath);

            try {
                // Check if file exists
                await fs.access(fullPath);

                totalFiles++;
                let fileModified = false;

                this.log(`🔍 Processing: ${scriptPath}`, 'progress');

                // 1. Normalize line endings
                const lineEndingsFixed = await this.normalizeLineEndings(fullPath);
                if (lineEndingsFixed) {
                    fileModified = true;
                    this.log(`  ✅ Fixed line endings`, 'success');
                }

                // 2. Ensure proper shebang
                const shebangFixed = await this.ensureCrossPlatformShebang(fullPath);
                if (shebangFixed) {
                    fileModified = true;
                    this.log(`  ✅ Fixed shebang`, 'success');
                }

                // 3. Fix cross-platform issues
                const crossPlatformFixed = await this.fixCrossPlatformIssues(fullPath);
                if (crossPlatformFixed) {
                    fileModified = true;
                    this.log(`  ✅ Fixed cross-platform issues`, 'success');
                }

                // 4. Make executable
                await this.ensureExecutable(fullPath);

                if (fileModified) {
                    fixedCount++;
                    this.log(`  📝 File was modified`, 'info');
                } else {
                    this.log(`  ✅ File already compatible`, 'success');
                }
            } catch (error) {
                this.log(`  ❌ Error: ${error.message}`, 'error');
            }
        }

        this.log('', 'info');
        this.log('🎉 Cross-Platform Fix Summary:', 'success');
        this.log(`   Total files processed: ${totalFiles}`, 'info');
        this.log(`   Files modified: ${fixedCount}`, 'info');
        this.log(`   Files already compatible: ${totalFiles - fixedCount}`, 'info');

        return fixedCount;
    }

    /**
     * Validate scripts are working
     */
    async validateScripts() {
        this.log('🔍 Validating Cross-Platform Compatibility...', 'progress');

        for (const scriptPath of this.shellScripts) {
            const fullPath = path.join(this.projectRoot, scriptPath);

            try {
                await fs.access(fullPath);

                // Read first few lines to check for proper shebang
                const content = await fs.readFile(fullPath, 'utf8');
                const lines = content.split('\n').slice(0, 5);

                const hasShebang = lines[0]?.startsWith('#!') || lines[1]?.startsWith('#!');
                const hasSetE = lines.some((line) => line.trim() === 'set -e');

                if (!hasShebang) {
                    this.log(`  ⚠️  ${scriptPath}: Missing shebang`, 'warning');
                } else if (!hasSetE && scriptPath.endsWith('.sh')) {
                    this.log(`  ⚠️  ${scriptPath}: Missing 'set -e'`, 'warning');
                } else {
                    this.log(`  ✅ ${scriptPath}: Valid structure`, 'success');
                }
            } catch (error) {
                this.log(`  ❌ ${scriptPath}: ${error.message}`, 'error');
            }
        }
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const projectRoot = process.cwd();
    const fixer = new CrossPlatformFixer(projectRoot);
    const args = process.argv.slice(2);
    const command = args[0] || 'fix';

    console.log('🔧 Cross-Platform Script Fixer');
    console.log('==============================\n');

    if (['help', '--help', '-h'].includes(command)) {
        console.log(`
USAGE:
  node scripts/utils/cross-platform-fixer.js [command]

COMMANDS:
  fix                   Fix all shell scripts for cross-platform compatibility
  validate              Validate existing scripts for issues
  help                  Show this help message

FEATURES:
  🔧 Normalizes line endings (\\r\\n → \\n)
  📝 Ensures proper shebangs
  🌐 Fixes cross-platform command issues
  🔐 Makes scripts executable
  ⚡ Validates script structure

EXAMPLES:
  node scripts/utils/cross-platform-fixer.js fix
  node scripts/utils/cross-platform-fixer.js validate
`);
        return;
    }

    if (command === 'fix') {
        fixer
            .fixAllScripts()
            .then((fixedCount) => {
                process.exit(fixedCount > 0 ? 0 : 1);
            })
            .catch((error) => {
                console.error('❌ Cross-platform fixer failed:', error.message);
                process.exit(1);
            });
    } else if (command === 'validate') {
        fixer
            .validateScripts()
            .then(() => {
                console.log('\n✅ Validation completed');
            })
            .catch((error) => {
                console.error('❌ Validation failed:', error.message);
                process.exit(1);
            });
    } else {
        console.error('❌ Unknown command:', command);
        console.error('Use "help" to see available commands');
        process.exit(1);
    }
}

export { CrossPlatformFixer };
