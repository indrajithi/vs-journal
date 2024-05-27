const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let disposable = vscode.commands.registerCommand('extension.createJournalEntry', function () {
		const journalDir = path.join(os.homedir(), 'VSJournal');
		const journalsDir = path.join(journalDir, 'journals');
		const date = new Date();
		const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.md`;
		const filePath = path.join(journalsDir, fileName);

		// Ensure that the parent directory VSJournal exists
		if (!fs.existsSync(journalDir)) {
				fs.mkdirSync(journalDir);
		}

		// Ensure that the journals directory exists
		if (!fs.existsSync(journalsDir)) {
				fs.mkdirSync(journalsDir);
		}

		// Create the journal file if it doesn't exist
		if (!fs.existsSync(filePath)) {
				fs.writeFileSync(filePath, `# Journal Entry - ${date.toDateString()}\n\n`);
		}

		// Open the journal file
		vscode.workspace.openTextDocument(filePath).then(doc => {
				vscode.window.showTextDocument(doc);
		});
});

		let disposableSetGitRemote = vscode.commands.registerCommand('extension.setGitRemote', async function () {
			const journalDir = path.join(os.homedir(), 'VSJournal');
			
			if (!fs.existsSync(journalDir)) {
					vscode.window.showErrorMessage('VSJournal: directory does not exist. Please create it first.');
					return;
			}

			// Change the current working directory to the VSJournal directory
			process.chdir(journalDir);

			if (!isGitRepository(journalDir)) {
					exec('git init', (error, stdout, stderr) => {
							if (error) {
									vscode.window.showErrorMessage(`VSJournal: Failed to initialize Git repository: ${error.message}`);
									return;
							}
							if (stderr) {
									vscode.window.showErrorMessage(`VSJournal: Failed to initialize Git repository: ${stderr}`);
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
        vscode.window.showErrorMessage('VSJournal: Directory does not exist. Please create it first.');
        return;
    }

		vscode.window.showInformationMessage('VSJournal: Syncing changes...');


    process.chdir(journalDir);

    if (!isGitRepository()) {
        vscode.window.showErrorMessage('VSJournal: Not in a Git repository. Please open a VS Journal directory with Git initialized.');
        return;
    }

		exec('git fetch && git branch --set-upstream-to=origin/master master && git config pull.rebase false && git pull --strategy=recursive -X theirs --allow-unrelated-histories', (error, stdout, stderr) => {
			if (error) {
					vscode.window.showErrorMessage(`VSJournal: Failed to pull changes from GitHub: ${error.message}`);
					return;
			}
			if (stderr) {
					vscode.window.showErrorMessage(`VSJournal: git pull stderr: ${stderr}`)
					return
			}
			// Proceed with pushing changes after pulling
			vscode.window.showInformationMessage('VSJournal: Pulled latest from remote');

			// Check if there are changes to commit
			exec('git status --porcelain', (error, stdout, stderr) => {
				if (error) {
						vscode.window.showErrorMessage(`VSJournal: Failed to check for changes: ${error.message}`);
						return;
				}
				if (stderr) {
						vscode.window.showErrorMessage(`VSJournal: Failed to check for changes: ${stderr}`);
						return;
				}

				// If there are no changes to commit, display a message and return
				if (stdout.trim() === '') {
						console.log('No changes to sync.')
						vscode.window.showInformationMessage('VSJournal: No changes to commit and push.');
						return;
				}

				// Execute git commands to add, commit, and push changes
				exec('git add . && git commit -m "Sync to GitHub"', (error, stdout, stderr) => {
						if (error) {
								vscode.window.showErrorMessage(`VSJournal: Failed to commit changes: ${error.message}`);
								return;
						}
						if (stderr) {
								vscode.window.showErrorMessage(`VSJournal: Failed to commit changes: ${stderr}`);
								return;
						}

						push()
				});
		});
		});
});

function push() {
	// Ensure there is a local master branch
	exec('git rev-parse --verify master', (error, stdout, stderr) => {
		if (error || stderr) {
				// If master branch doesn't exist, create it
				exec('git checkout -b master', () => {
						// Push changes to origin master
						pushToOriginMaster();
				});
		} else {
				// Push changes to origin master
				pushToOriginMaster();
		}
});
}


function pushToOriginMaster() {
	// Execute git pull to integrate any remote changes
	exec('git fetch && git branch --set-upstream-to=origin/master master && git config pull.rebase false && git pull --strategy=recursive -X theirs --allow-unrelated-histories', (error, stdout, stderr) => {
			if (error) {
					vscode.window.showErrorMessage(`Failed to pull changes from GitHub: ${error.message}`);
					return;
			}
			if (stderr) {
					console.log(`git pull stderr: ${stderr}`);
			}
			// Proceed with pushing changes after pulling
			pushChanges();
	});
}

function pushChanges() {
	// Execute git push to push changes
	exec('git push --set-upstream origin master', (error, stdout, stderr) => {
			if (error && error.code !== 128) { // Ignore exit code 128 (non-error, e.g., when the branch is already up-to-date)
					vscode.window.showErrorMessage(`Failed to push changes to GitHub: ${error.message}`);
					return;
			}
			if (stderr) {
					console.log(`git push stderr: ${stderr}`);
			}
			vscode.window.showInformationMessage('VSJournal: Changes synced to remote successfully.');
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

			// Remove existing remote origin (if it exists)
			exec('git init && git remote rm origin', () => {
					// Set Git remote URL as origin
					exec(`git remote add origin ${remoteUrl}`, (error, stdout, stderr) => {
							if (error) {
									vscode.window.showErrorMessage(`VSJournal: Failed to set Git remote: ${error.message}`);
									return;
							}
							if (stderr) {
									vscode.window.showErrorMessage(`VSJournal: Failed to set Git remote: ${stderr}`);
									return;
							}
							vscode.window.showInformationMessage('VSJournal: Git remote set successfully.');
					});
			});
	});
}


function deactivate() {}

module.exports = {
    activate,
    deactivate
};
