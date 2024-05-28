const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

/**
 * @param {vscode.ExtensionContext} context
 */

const journalDir = path.join(os.homedir(), 'VSJournal');

function activate(context) {
	let disposable = vscode.commands.registerCommand('extension.createJournalEntry', function () {
		const journalsDir = path.join(journalDir, 'journals');
		const date = new Date();
		const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.md`;
		const filePath = path.join(journalsDir, fileName);

		if (!fs.existsSync(journalDir)) {
				fs.mkdirSync(journalDir);
		}

		if (!fs.existsSync(journalsDir)) {
				fs.mkdirSync(journalsDir);
		}

		if (!fs.existsSync(filePath)) {
				fs.writeFileSync(filePath, `# Journal Entry - ${date.toDateString()}\n\n`);
		}

		vscode.workspace.openTextDocument(filePath).then(doc => {
				vscode.window.showTextDocument(doc);
		});
});

		let disposableSetGitRemote = vscode.commands.registerCommand('extension.setGitRemote', async function () {
			const journalDir = path.join(os.homedir(), 'VSJournal');
			
			if (!fs.existsSync(journalDir)) {
					vscode.window.showErrorMessage('VSJournal directory does not exist. Please create it first.');
					return;
			}

			process.chdir(journalDir);

			if (!isGitRepository(journalDir)) {
					exec('git init', (error, stdout, stderr) => {
							if (error) {
									vscode.window.showErrorMessage(`Failed to initialize Git repository: ${error.message}`);
									return;
							}
							if (stderr) {
									vscode.window.showErrorMessage(`Failed to initialize Git repository: ${stderr}`);
									return;
							}
							setRemote();
					});
			} else {
					setRemote();
			}
	});

	let disposableSync = vscode.commands.registerCommand('extension.syncToGitHub', function () {
    const journalDir = path.join(os.homedir(), 'VSJournal');

    if (!fs.existsSync(journalDir)) {
        vscode.window.showErrorMessage('VSJournal directory does not exist. Please create it first.');
        return;
    }

    process.chdir(journalDir);

    if (!isGitRepository()) {
        vscode.window.showErrorMessage('Not in a Git repository. Please open a VS Journal directory with Git initialized.');
        return;
    }

    // Check if there are changes to commit
    exec('git status --porcelain', (error, stdout, stderr) => {
        if (error) {
            vscode.window.showErrorMessage(`Failed to check for changes: ${error.message}`);
            return;
        }
        if (stderr) {
            vscode.window.showErrorMessage(`Failed to check for changes: ${stderr}`);
            return;
        }

        // If there are no changes to commit, display a message and return
        if (stdout.trim() === '') {
						console.log('No changes to sync.')
            vscode.window.showInformationMessage('No changes to sync.');
            return;
        }

        // Execute git commands to add, commit, and push changes
        exec('git add . && git commit -m "Sync to GitHub"', (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to commit changes: ${error.message}`);
                return;
            }
            if (stderr) {
                vscode.window.showErrorMessage(`Failed to commit changes: ${stderr}`);
                return;
            }

            // Ensure there is a local master branch
            exec('git rev-parse --verify master', (error, stdout, stderr) => {
                if (error || stderr) {
                    // If master branch doesn't exist, create it
                    exec('git checkout -b master', (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`Failed to create master branch: ${error.message}`);
                            return;
                        }
                        if (stderr) {
                            vscode.window.showErrorMessage(`Failed to create master branch: ${stderr}`);
                            return;
                        }
                        // Push changes to origin master
                        pushToOriginMaster();
                    });
                } else {
                    // Push changes to origin master
                    pushToOriginMaster();
                }
            });
        });
    });
});


function pushToOriginMaster() {
	exec('git fetch && git branch --set-upstream-to=origin/master master && git config pull.rebase false && git pull --strategy=recursive -X theirs --allow-unrelated-histories', (error, stdout, stderr) => {
			if (error) {
					vscode.window.showErrorMessage(`Failed to pull changes from GitHub: ${error.message}`);
					return;
			}
			if (stderr) {
					console.log(`git pull stderr: ${stderr}`);
			}
			pushChanges();
	});
}

function pushChanges() {
	exec('git push --set-upstream origin master', (error, stdout, stderr) => {
			if (error && error.code !== 128) { // Ignore exit code 128 (non-error, e.g., when the branch is already up-to-date)
					vscode.window.showErrorMessage(`Failed to push changes to GitHub: ${error.message}`);
					return;
			}
			if (stderr) {
					console.log(`git push stderr: ${stderr}`);
			}
			vscode.window.showInformationMessage('Changes synced to GitHub successfully.');
	});
}

    context.subscriptions.push(disposable, disposableSetGitRemote, disposableSync);
}

function isGitRepository(directory) {
	directory = directory || path.join(os.homedir(), 'VSJournal');
	return fs.existsSync(path.join(directory, '.git'));
}


function setRemote() {
	// Prompt user for Git remote URL
	vscode.window.showInputBox({
			placeHolder: 'Enter Git remote URL',
			prompt: 'Enter the URL of the Git remote repository (e.g., git@github.com:username/repository.git)'
	}).then(remoteUrl => {
			if (!remoteUrl) {
					// User cancelled the input box
					return;
			}

			exec('git remote rm origin', () => {
					exec(`git remote add origin ${remoteUrl}`, (error, stdout, stderr) => {
							if (error) {
									vscode.window.showErrorMessage(`Failed to set Git remote: ${error.message}`);
									return;
							}
							if (stderr) {
									vscode.window.showErrorMessage(`Failed to set Git remote: ${stderr}`);
									return;
							}
							checkoutMaster()
							vscode.window.showInformationMessage('Git remote set successfully.');
					});
			});
	});
}

function checkoutMaster() {
	// Check if the repository has any commits
	exec('git rev-parse --is-inside-work-tree', (error, stdout, stderr) => {
			if (error || stderr) {
					vscode.window.showErrorMessage(`Failed to check if inside a Git repository: ${error?.message || stderr}`);
					return;
			}

			// Check the current branch
			exec('git rev-parse --abbrev-ref HEAD', (error, stdout, stderr) => {
					if (error || stderr) {
							// If there is no branch yet, create the master branch
							if (stderr.includes("unknown revision or path not in the working tree")) {
									createMasterBranch();
							} else {
									vscode.window.showErrorMessage(`Failed to get current branch: ${error?.message || stderr}`);
							}
							return;
					}

					const currentBranch = stdout.trim();
					if (currentBranch === 'master') {
							vscode.window.showInformationMessage('Already on master branch.');
					} else {
							createMasterBranch();
					}
			});
	});
}

function createMasterBranch() {
	exec('git checkout -b master', (error, stdout, stderr) => {
			if (error && !stderr.includes("Switched to a new branch 'master'")) {
					vscode.window.showErrorMessage(`Failed to create master branch: ${error.message}`);
					return;
			}
			vscode.window.showInformationMessage('Switched to master branch.');
	});
}




function deactivate() {}

module.exports = {
    activate,
    deactivate
};
