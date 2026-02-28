import * as vscode from "vscode";
import { ConfigLoader } from "../config/configLoader";
import { ConfigPanel } from "../webview/configPanel";

export function createEditConfigCommand(
  context: vscode.ExtensionContext,
  configLoader: ConfigLoader
): () => void {
  return () => {
    ConfigPanel.createOrShow(context, configLoader);
  };
}
