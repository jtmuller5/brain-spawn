---
name: release
description: Finalize and publish a new minor release of the Brain Spawn VS Code extension. Packages the extension, updates the changelog, deletes old .vsix files, and publishes to the marketplace.
user_invocable: true
---

# Release Skill

Perform a full minor release of the Brain Spawn extension. Follow these steps in order:

## Step 1: Gather context

1. Read `package.json` to get the current version.
2. Run `git log --oneline` from the last version tag to HEAD to collect the changes that will go into the changelog.
3. Find all existing `.vsix` files in the project root using Glob for `*.vsix`.

## Step 2: Update the changelog

1. Read `CHANGELOG.md`.
2. Determine the next minor version by bumping the minor component of the current version in `package.json` (e.g., 0.10.0 -> 0.11.0).
3. Add a new section at the top of the changelog (after the `# Changelog` heading) for the new version with a summary of changes derived from the git log. Use concise bullet points describing what was added, changed, or fixed.
4. Write the updated `CHANGELOG.md`.

## Step 3: Delete old .vsix files

Delete all existing `.vsix` files found in step 1 from the project root. These are outdated build artifacts.

## Step 4: Package the extension

Run the package command:
```bash
npx @vscode/vsce package
```

This creates a new `.vsix` file for the upcoming version.

## Step 5: Publish the minor release

Run the publish command:
```bash
npx @vscode/vsce publish minor
```

This bumps the minor version in `package.json` and publishes to the VS Code marketplace.

## Step 6: Commit and tag

1. Stage all changed files (`package.json`, `CHANGELOG.md`, and any other modified files).
2. Create a commit with the message: `<new_version>` (e.g., `0.11.0`).
3. Ask the user if they want to push to the remote.

## Important notes

- Always confirm with the user before running the publish command (Step 5).
- If any step fails, stop and report the error rather than continuing.
- The publish command will automatically bump the version in `package.json`, so the changelog should use the version that `publish minor` will produce (current minor + 1).
