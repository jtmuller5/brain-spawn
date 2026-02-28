import * as vscode from "vscode";

export function substituteVariables(value: string): string {
  const workspaceFolder =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  const workspaceFolderBasename =
    vscode.workspace.workspaceFolders?.[0]?.name ?? "";

  let result = value;
  result = result.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
  result = result.replace(
    /\$\{workspaceFolderBasename\}/g,
    workspaceFolderBasename
  );
  result = result.replace(/\$\{env:([^}]+)\}/g, (_match, varName: string) => {
    return process.env[varName] ?? "";
  });

  return result;
}
