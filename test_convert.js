const fs = require('fs');

function mdToHtml(md) {
    let html = md;
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/^##### ([^\n]+)$/gm, "<h5>$1</h5>");
    html = html.replace(/^#### ([^\n]+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^### ([^\n]+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## ([^\n]+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# ([^\n]+)$/gm, "<h1>$1</h1>");
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;margin:10px 0;">');
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/^> (.*)$/gm, "<blockquote>$1</blockquote>");
    html = html.replace(/<\/blockquote>\n<blockquote>/g, "<br>");
    html = html.replace(/^(?:---|\*\*\*|___)$/gm, "<hr>");

    // Normalize line endings
    html = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    const lines = html.split("\n");
    const listStack = [];
    const resultLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const listMatch = line.match(/^(\s*)([\*\-\+]|\d+\.) (.*)$/);

        if (listMatch) {
            const indent = listMatch[1].length;
            const isOrdered = /^\d/.test(listMatch[2]);
            const content = listMatch[3];
            const listTag = isOrdered ? "ol" : "ul";

            while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
                const last = listStack.pop();
                resultLines.push(`</${last.tag}>`);
            }

            if (listStack.length === 0 || indent > listStack[listStack.length - 1].indent) {
                listStack.push({ indent, tag: listTag });
                resultLines.push(`<${listTag}>`);
                resultLines.push(`<li>${content}</li>`);
            } else if (indent === listStack[listStack.length - 1].indent) {
                if (listTag !== listStack[listStack.length - 1].tag) {
                    const last = listStack.pop();
                    resultLines.push(`</${last.tag}>`);
                    listStack.push({ indent, tag: listTag });
                    resultLines.push(`<${listTag}>`);
                }
                resultLines.push(`<li>${content}</li>`);
            }
        } else {
            while (listStack.length > 0) {
                const last = listStack.pop();
                resultLines.push(`</${last.tag}>`);
            }
            resultLines.push(line);
        }
    }
    while (listStack.length > 0) {
        const last = listStack.pop();
        resultLines.push(`</${last.tag}>`);
    }
    html = resultLines.join("\n");

    const blocks = html.split(/\n\n+/);
    html = blocks.map(block => {
        block = block.trim();
        if (!block) return "";
        if (block.match(/^<(h1|h2|h3|h4|h5|img|a|ul|ol|blockquote|hr)/)) return block;
        return "<p>" + block.replace(/\n/g, "<br>") + "</p>";
    }).join("\n");

    return html;
}

const readme = fs.readFileSync('Readme.md', 'utf-8');
const result = mdToHtml(readme);
fs.writeFileSync('output.html', result);
console.log("Output written to output.html");
