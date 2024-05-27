const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let disposable = vscode.commands.registerCommand('extension.createJournalEntry', function () {
        const journalDir = path.join(os.homedir(), 'journal');
        const date = new Date();
        const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.md`;
        const filePath = path.join(journalDir, fileName);

        if (!fs.existsSync(journalDir)) {
            fs.mkdirSync(journalDir);
        }

        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, `# Journal Entry - ${date.toDateString()}\n\n`);
        }

        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
