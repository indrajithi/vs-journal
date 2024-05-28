 
const vscode = require('vscode')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {exec} = require('child_process')

/**
 * @param {vscode.ExtensionContext} context
 */

const ROOT_DIR = path.join(os.homedir(), 'VSJournal')
const JOURNALS_DIR = path.join(ROOT_DIR, 'journals')
const NOTES_DIR = path.join(ROOT_DIR, 'notes')


function createDirsIfNotExist() {
  if (!fs.existsSync(ROOT_DIR)) {
    fs.mkdirSync(ROOT_DIR)
  }

  if (!fs.existsSync(JOURNALS_DIR)) {
    fs.mkdirSync(JOURNALS_DIR)
  }

  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR)
  }
}


function activate(context) {
  const disposableCreateJournal = vscode.commands.registerCommand('extension.createJournalEntry', function() {
    const date = new Date()
     
    const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.md`
    const filePath = path.join(JOURNALS_DIR, fileName)

    createDirsIfNotExist()
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# Journal Entry - ${date.toDateString()}\n\n`)
    }

    vscode.workspace.openTextDocument(filePath).then((doc) => {
      vscode.window.showTextDocument(doc)
    })
  })


  const disposableCreateNote = vscode.commands.registerCommand('extension.createNoteEntry', function() {
    vscode.window.showInputBox({
      placeHolder: 'Enter Note Title',
      prompt: 'Enter a title for the note or Leave it empty for current timestamp',
    }).then((title) => {
      createNewNote(title)
    })
  })

	function formatTitle(title) {
		return title.toLowerCase().replace(/\s+/g, '-');
	}

  function createNewNote(title) {
    const date = new Date()
    const noteTitle = title ? date.toISOString().slice(0, 19) + '-' + formatTitle(title) + '.md' : date.toISOString().slice(0, 19) + '.md'
    createDirsIfNotExist()

    const filePath = path.join(NOTES_DIR, noteTitle)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `# Note: ${title} - ${date.toUTCString().slice(0, 19)}\n\n`)
    }

    vscode.workspace.openTextDocument(filePath).then((doc) => {
      vscode.window.showTextDocument(doc)
    })
  }

  const disposableSetGitRemote = vscode.commands.registerCommand('extension.setGitRemote', async function() {
    if (!fs.existsSync(ROOT_DIR)) {
      createDirsIfNotExist()
    }

    process.chdir(ROOT_DIR)

    if (!isGitRepository(ROOT_DIR)) {
      exec('git init', (error, stdout, stderr) => {
        if (error) {
          vscode.window.showErrorMessage(`VSJournal: Failed to initialize Git repository: ${error.message}`)
          return
        }
        if (stderr) {
          vscode.window.showErrorMessage(`VSJournal: Failed to initialize Git repository: ${stderr}`)
          return
        }
        setRemote()
      })
    } else {
      setRemote()
    }
  })

  const disposableSync = vscode.commands.registerCommand('extension.syncToGitHub', function() {
    if (!fs.existsSync(ROOT_DIR)) {
      vscode.window.showErrorMessage('VSJournal: directory does not exist. Please create it first.')
      return
    }

    process.chdir(ROOT_DIR)

    if (!isGitRepository()) {
       
      vscode.window.showErrorMessage('VSJournal: Please run set remote command before sync.')
      return
    }

    exec('git status --porcelain', (error, stdout, stderr) => {
      if (error) {
        vscode.window.showErrorMessage(`VSJournal: Failed to check for changes: ${error.message}`)
        return
      }
      if (stderr) {
        vscode.window.showErrorMessage(`VSJournal: Failed to check for changes: ${stderr}`)
        return
      }

      if (stdout.trim() === '') {
        console.log('No changes to sync.')
        vscode.window.showInformationMessage('VSJournal: No changes to sync.')
        return
      }

      exec('git add . && git commit -m "Sync to Remote"', (error, stdout, stderr) => {
        if (error) {
          vscode.window.showErrorMessage(`VSJournal: Failed to commit changes: ${error.message}`)
          return
        }
        if (stderr) {
          vscode.window.showErrorMessage(`VSJournal: Failed to commit changes: ${stderr}`)
          return
        }

        exec('git rev-parse --verify master', (error, stdout, stderr) => {
          if (error || stderr) {
            // If master branch doesn't exist, create it
            exec('git checkout -b master', (error, stdout, stderr) => {
              if (error) {
                vscode.window.showErrorMessage(`VSJournal: Failed to create master branch: ${error.message}`)
                return
              }
              if (stderr) {
                vscode.window.showErrorMessage(`VSJournal: Failed to create master branch: ${stderr}`)
                return
              }
              pushToOriginMaster()
            })
          } else {
            pushToOriginMaster()
          }
        })
      })
    })
  })


  function pushToOriginMaster() {

		vscode.window.showInformationMessage('VSJournal: Syncing remote repository...')

     
    exec('git fetch && git branch --set-upstream-to=origin/master master && git config pull.rebase false && git pull --strategy=recursive -X theirs --allow-unrelated-histories', (error, stdout, stderr) => {
      if (error) {
				if (error.message.includes(`fatal: the requested upstream branch 'origin/master' does not exist`)){
					pushChanges()
				}
        return
      }
      if (stderr) {
        console.log(`git pull stderr: ${stderr}`)
      }
      pushChanges()
    })
  }

  function pushChanges() {
    exec('git push --set-upstream origin master', (error, stdout, stderr) => {
       
      if (error && error.code !== 128) { // Ignore exit code 128 (non-error, e.g., when the branch is already up-to-date)
        vscode.window.showErrorMessage(`VSJournal: Failed to push changes to remote repository: ${error.message}`)
        return
      }
      if (stderr) {
        console.log(`git push stderr: ${stderr}`)
      }
      vscode.window.showInformationMessage('VSJournal: Changes synced to remote repository')
    })
  }

  context.subscriptions.push(disposableCreateJournal, disposableCreateNote, disposableSetGitRemote, disposableSync)
}

function isGitRepository(directory) {
  directory = directory || path.join(os.homedir(), 'VSJournal')
  return fs.existsSync(path.join(directory, '.git'))
}


function setRemote() {
  vscode.window.showInputBox({
    placeHolder: 'Enter Git remote URL',
    prompt: 'Enter the URL of the Git remote repository (e.g., git@github.com:username/repository.git)',
  }).then((remoteUrl) => {
    if (!remoteUrl) {
      return
    }

    exec('git remote rm origin', () => {
      exec(`git remote add origin ${remoteUrl}`, (error, stdout, stderr) => {
        if (error) {
          vscode.window.showErrorMessage(`VSJournal: Failed to set Git remote: ${error.message}`)
          return
        }
        if (stderr) {
          vscode.window.showErrorMessage(`VSJournal: Failed to set Git remote: ${stderr}`)
          return
        }
        checkoutMaster()
        vscode.window.showInformationMessage('VSJournal: Git remote set successfully.')
      })
    })
  })
}

function checkoutMaster() {
  exec('git rev-parse --is-inside-work-tree', (error, stdout, stderr) => {
    if (error || stderr) {
      vscode.window.showErrorMessage(`VSJournal: Failed to check if inside a Git repository: ${error?.message || stderr}`)
      return
    }

    exec('git rev-parse --abbrev-ref HEAD', (error, stdout, stderr) => {
      if (error || stderr) {
        if (stderr.includes('unknown revision or path not in the working tree')) {
          createMasterBranch()
        } else {
          vscode.window.showErrorMessage(`VSJournal: Failed to get current branch: ${error?.message || stderr}`)
        }
        return
      }

      const currentBranch = stdout.trim()
      if (currentBranch !== 'master') {
        createMasterBranch()
      }
    })
  })
}

function createMasterBranch() {
  exec('git checkout -b master', (error, stdout, stderr) => {
    if (error && !stderr.includes('Switched to a new branch \'master\'')) {
      vscode.window.showErrorMessage(`VSJournal: Failed to create master branch: ${error.message}`)
      return
    }
    vscode.window.showInformationMessage('VSJournal: Switched to master branch.')
  })
}


function deactivate() {}

module.exports = {
  activate,
  deactivate,
}
