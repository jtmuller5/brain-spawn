import * as vscode from "vscode";
import { ConfigLoader } from "../config/configLoader";
import { WebviewMessage } from "../types";
import { validateConfig } from "../config/configSchema";

export async function handleWebviewMessage(
  message: WebviewMessage,
  webview: vscode.Webview,
  configLoader: ConfigLoader
): Promise<void> {
  switch (message.type) {
    case "ready":
    case "getConfig": {
      const config = configLoader.getConfig();
      webview.postMessage({ type: "config", config });
      break;
    }

    case "saveConfig": {
      try {
        const validated = validateConfig(message.config);
        await configLoader.saveAll(validated);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        webview.postMessage({ type: "error", message: msg });
      }
      break;
    }

    case "pickFolder": {
      const result = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: "Select Working Directory",
      });
      if (result && result[0]) {
        webview.postMessage({
          type: "folderPicked",
          path: result[0].fsPath,
        });
      }
      break;
    }
  }
}
