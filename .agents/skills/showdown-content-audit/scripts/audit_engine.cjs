const fs = require('fs');
const path = require('path');

const ADR_0001_LIMITS = {
    'ladder': 20, // per rung
    'drop': 100,
    'wheel': 100,
    'grid': 5 // categories
};

const IP_RISKS = [
    'Disney', 'Marvel', 'Star Wars', 'Harry Potter', 'Hogwarts', 'Lego', 'Coca-Cola', 
    'McDonalds', 'Apple', 'Google', 'Netflix', 'Amazon', 'Facebook', 'Instagram',
    'Batman', 'Superman', 'Spiderman', 'Pokemon', 'Nintendo', 'Sony', 'PlayStation',
    'Mickey Mouse', 'James Bond', 'Gandalf', 'Skyrim', 'Minecraft', 'Mario', 'iPhone'
];

const SIMPLICITY_PATTERNS = [
    { regex: /\bWhat color is a? \w+\?\b/i, name: 'Basic Color' },
    { regex: /\bJakiego koloru jest \w+\?\b/i, name: 'Basic Color (PL)' },
    { regex: /\bHow many legs does a? \w+ have\?\b/i, name: 'Basic Counting' },
    { regex: /\bIle nóg ma \w+\?\b/i, name: 'Basic Counting (PL)' },
    { regex: /\bHow many fingers does a? \w+ have\?\b/i, name: 'Basic Counting' },
    { regex: /\bIle palców ma \w+\?\b/i, name: 'Basic Counting (PL)' },
    { regex: /\bWhat is \d \+ \d\b/i, name: 'Basic Arithmetic' },
    { regex: /\bIle to jest \d \+ \d\b/i, name: 'Basic Arithmetic (PL)' },
    { regex: /\b(small|big|large|fast|slow|heavy|light) and (yellow|red|blue|green|white|black)\b/i, name: 'Ambiguous Descriptor' },
    { regex: /\b(mały|duży|wielki|szybki|wolny|ciężki|lekki) i (żółty|czerwony|niebieski|zielony|biały|czarny)\b/i, name: 'Ambiguous Descriptor (PL)' }
];

const audit = {
    errors: [],
    warnings: [],
    stats: {}
};

function checkQuality(name, text) {
    if (typeof text !== 'string') return;
    SIMPLICITY_PATTERNS.forEach(pattern => {
        if (pattern.regex.test(text)) {
            audit.warnings.push(`[LOW QUALITY] ${name}: Found over-simple or ambiguous pattern "${pattern.name}" in "${text}".`);
        }
    });
}

function checkDuplicates(name, list) {
    const seen = new Set();
    const dups = [];
    list.forEach(item => {
        if (!item) return;
        const key = item.toLowerCase().trim();
        if (seen.has(key)) dups.push(item);
        seen.add(key);
    });
    if (dups.length > 0) audit.errors.push(`[DUPLICATE INTERNAL] ${name}: ${[...new Set(dups)].join(', ')}`);
}

function checkIP(name, text) {
    if (typeof text !== 'string') return;
    IP_RISKS.forEach(risk => {
        const regex = new RegExp(`\\b${risk}\\b`, 'i');
        if (regex.test(text)) {
            audit.warnings.push(`[IP RISK] ${name}: Found potential trademarked term "${risk}" in "${text}".`);
        }
    });
}

function auditJsonPack(filePath, data) {
    const relPath = path.relative(process.cwd(), filePath);
    const type = data.type || 'unknown';
    
    if (type === 'ladder') {
        const questions = data.questions || [];
        audit.stats[relPath] = { count: questions.length, type };
        
        questions.forEach((q, i) => {
            const id = q.id || `Q${i+1}`;
            if (!q.prompt?.en || !q.prompt?.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${id}: Prompt`);
            if (!q.options || q.options.length !== 4) audit.errors.push(`[INVALID STRUCT] ${relPath} ${id}: Expected 4 options`);
            
            if (q.options) {
                checkDuplicates(`${relPath} ${id} (EN options)`, q.options.map(o => o.en));
                checkDuplicates(`${relPath} ${id} (PL options)`, q.options.map(o => o.pl));
            }

            q.options?.forEach((opt, oi) => {
                if (!opt.en || !opt.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${id}: Option ${oi}`);
                checkIP(`${relPath} ${id}`, opt.en);
            });
            if (q.correctIndex < 0 || q.correctIndex > 3) audit.errors.push(`[INVALID DATA] ${relPath} ${id}: correctIndex ${q.correctIndex}`);
            checkIP(`${relPath} ${id}`, q.prompt?.en);
            checkQuality(`${relPath} ${id}`, q.prompt?.en);
        });

        checkDuplicates(`${relPath} (EN)`, questions.map(q => q.prompt?.en));
    } else if (type === 'drop') {
        const questions = data.questions || [];
        audit.stats[relPath] = { count: questions.length, type };
        
        questions.forEach((q, i) => {
            const id = q.id || `Q${i+1}`;
            if (!q.prompt?.en || !q.prompt?.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${id}: Prompt`);
            if (!q.options || q.options.length !== 4) audit.errors.push(`[INVALID STRUCT] ${relPath} ${id}: Expected 4 options`);
            
            if (q.options) {
                checkDuplicates(`${relPath} ${id} (EN options)`, q.options.map(o => o.en));
                checkDuplicates(`${relPath} ${id} (PL options)`, q.options.map(o => o.pl));
            }

            q.options?.forEach((opt, oi) => {
                if (!opt.en || !opt.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${id}: Option ${oi}`);
                checkIP(`${relPath} ${id}`, opt.en);
            });
            if (q.correctIndex < 0 || q.correctIndex > 3) audit.errors.push(`[INVALID DATA] ${relPath} ${id}: correctIndex ${q.correctIndex}`);
            checkIP(`${relPath} ${id}`, q.prompt?.en);
            checkQuality(`${relPath} ${id}`, q.prompt?.en);
        });
        checkDuplicates(`${relPath} (EN)`, questions.map(q => q.prompt?.en));
    } else if (type === 'wheel') {
        const puzzles = data.puzzles || [];
        audit.stats[relPath] = { count: puzzles.length, type };
        
        puzzles.forEach((p, i) => {
            const id = p.id || `P${i+1}`;
            if (!p.phrase?.en || !p.phrase?.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${id}: Phrase`);
            checkIP(`${relPath} ${id}`, p.phrase?.en);
            checkQuality(`${relPath} ${id}`, p.phrase?.en);
        });
        checkDuplicates(`${relPath} (EN)`, puzzles.map(p => p.phrase?.en));
    } else if (type === 'grid') {
        const categories = data.categories || [];
        audit.stats[relPath] = { count: categories.length, type };
        categories.forEach((cat, i) => {
            const cid = cat.name?.en || cat.title?.en || `Cat${i+1}`;
            if (cat.clues?.length !== 5) audit.errors.push(`[INVALID STRUCT] ${relPath} ${cid}: Expected 5 clues`);
            cat.clues?.forEach((clue, ci) => {
                if (!clue.clue?.en || !clue.clue?.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${cid} Clue ${ci}: Text`);
                checkIP(`${relPath} ${cid}`, clue.clue?.en);
                checkQuality(`${relPath} ${cid} Clue ${ci}`, clue.clue?.en);
            });
        });
    } else if (type === 'poll') {
        const surveys = data.surveys || [];
        audit.stats[relPath] = { count: surveys.length, type };
        surveys.forEach((s, i) => {
            const sid = s.question?.en || `Poll${i+1}`;
            if (!s.question?.en || !s.question?.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${sid}: Question`);
            s.answers?.forEach((ans, ai) => {
                if (!ans.text?.en || !ans.text?.pl) audit.errors.push(`[MISSING TRANS] ${relPath} ${sid} Ans ${ai}: Text`);
                checkIP(`${relPath} ${sid}`, ans.text?.en);
            });
            checkIP(`${relPath} ${sid}`, s.question?.en);
            checkQuality(`${relPath} ${sid}`, s.question?.en);
        });
    }
}

function auditTsFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(process.cwd(), filePath);
    
    // Simple regex counting for TS files
    const enCount = (content.match(/en: '([^']*)'/g) || []).length;
    const plCount = (content.match(/pl: '([^']*)'/g) || []).length;
    
    audit.stats[relPath] = { en: enCount, pl: plCount, type: 'typescript' };
    
    if (enCount !== plCount) {
        audit.errors.push(`[MISMATCH] ${relPath}: EN=${enCount} vs PL=${plCount}`);
    }

    // IP Check on the whole file for English strings
    const enStrings = [...content.matchAll(/en: '([^']*)'/g)].map(m => m[1]);
    enStrings.forEach(s => checkIP(relPath, s));
    enStrings.forEach(s => checkQuality(relPath, s));
    
    // Duplicate check for English prompts (best effort)
    const prompts = [...content.matchAll(/question: { en: '([^']*)'/g)].map(m => m[1]);
    if (prompts.length > 0) {
        checkDuplicates(`${relPath} (Prompts)`, prompts);
    } else {
        // If not ladder, check general strings but exclude short ones
        checkDuplicates(relPath, enStrings.filter(s => s.length > 15));
    }

    // Check for duplicate options in each question
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        const idMatch = line.match(/id:\s*'([^']+)'/);
        const optionsMatch = line.match(/options:\s*\[(.*?)\]/);
        if (idMatch && optionsMatch) {
            const id = idMatch[1];
            const optsStr = optionsMatch[1];
            const enOpts = [...optsStr.matchAll(/en:\s*'([^']+)'/g)].map(m => m[1]);
            const plOpts = [...optsStr.matchAll(/pl:\s*'([^']+)'/g)].map(m => m[1]);
            if (enOpts.length > 0) checkDuplicates(`${relPath} ${id} (EN options)`, enOpts);
            if (plOpts.length > 0) checkDuplicates(`${relPath} ${id} (PL options)`, plOpts);
        }
    });
}

const targetFiles = process.argv.slice(2);
targetFiles.forEach(f => {
    if (!fs.existsSync(f)) {
        audit.errors.push(`[FILE NOT FOUND] ${f}`);
        return;
    }

    if (f.endsWith('.json')) {
        try {
            const data = JSON.parse(fs.readFileSync(f, 'utf8'));
            auditJsonPack(f, data);
        } catch (e) {
            audit.errors.push(`[PARSE ERROR] ${f}: ${e.message}`);
        }
    } else if (f.endsWith('.ts')) {
        auditTsFile(f);
    }
});

if (require.main === module) {
    console.log(JSON.stringify(audit, null, 2));
}

module.exports = { audit, auditPackFile: auditJsonPack };
