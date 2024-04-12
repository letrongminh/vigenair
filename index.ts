/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const prompts = require("prompts");
const replace = require("replace");
const spawn = require("cross-spawn");

const DEFAULT_GCP_REGION = "us-central1";
const DEFAULT_GCS_LOCATION = "us";
const GCS_BUCKET_NAME_SUFFIX = "-vigenair";

interface ConfigReplace {
  regex: string;
  replacement: string;
  paths: string[];
}

interface PromptsResponse {
  gcpProjectId: string;
  gcpRegion?: string;
  gcsLocation?: string;
}

class ClaspManager {
  private static async isLoggedIn() {
    return await fs.exists(path.join(os.homedir(), ".clasprc.json"));
  }

  static async login() {
    const loggedIn = await this.isLoggedIn();

    if (!loggedIn) {
      console.log("Logging in via clasp...");
      spawn.sync("npx", ["clasp", "login"], { stdio: "inherit" });
    }
  }

  static async isConfigured(rootDir: string) {
    return (
      (await fs.exists(path.join(rootDir, ".clasp-dev.json"))) ||
      (await fs.exists(path.join(rootDir, "dist", ".clasp.json")))
    );
  }

  static extractSheetsLink(output: string) {
    const sheetsLink = output.match(/Google Sheet: ([^\n]*)/);

    return sheetsLink?.length ? sheetsLink[1] : "Not found";
  }

  static extractScriptLink(output: string) {
    const scriptLink = output.match(/Google Sheets Add-on script: ([^\n]*)/);

    return scriptLink?.length ? scriptLink[1] : "Not found";
  }

  static async create(
    title: string,
    scriptRootDir: string,
    filesRootDir: string
  ) {
    const res = spawn.sync(
      "npx",
      [
        "clasp",
        "create",
        "--type",
        "sheets",
        "--rootDir",
        scriptRootDir,
        "--title",
        `${title}`,
      ],
      { encoding: "utf-8" }
    );

    await fs.move(
      path.join(scriptRootDir, ".clasp.json"),
      path.join(filesRootDir, ".clasp-dev.json")
    );
    await fs.copyFile(
      path.join(filesRootDir, ".clasp-dev.json"),
      path.join(filesRootDir, ".clasp-prod.json")
    );
    const output = res.output.join();

    return {
      sheetLink: this.extractSheetsLink(output),
      scriptLink: this.extractScriptLink(output),
    };
  }
}

class GcpDeploymentHandler {
  static async checkGcloudAuth() {
    const gcloudAuthExists = await fs.exists(
      path.join(os.homedir(), ".config", "gcloud", "credentials.db")
    );
    if (!gcloudAuthExists) {
      console.log("Logging in via gcloud...");
      spawn.sync("gcloud auth login", { stdio: "inherit", shell: true });
      console.log();
    }
  }

  static deployGcpComponents() {
    console.log("Deploying GCP components...");
    spawn.sync("npm run deploy-service", { stdio: "inherit", shell: true });
  }
}

class UiDeploymentHandler {
  static async createScriptProject() {
    console.log();
    await ClaspManager.login();

    const claspConfigExists = await ClaspManager.isConfigured("./ui");
    if (claspConfigExists) {
      return;
    }
    console.log();
    console.log("Creating Apps Script Project...");
    const res = await ClaspManager.create("ViGenAiR", "./dist", "./ui");
    console.log();
    console.log("IMPORTANT -> Google Sheets Link:", res.sheetLink);
    console.log("IMPORTANT -> Apps Script Link:", res.scriptLink);
    console.log();
  }

  static deployUi() {
    console.log("Deploying UI Web App...");
    spawn.sync("npm run deploy-ui", { stdio: "inherit", shell: true });
    const res = spawn.sync("cd ui && clasp undeploy -a && clasp deploy", {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    const lastNonEmptyLine = res.output[1]
      .split("\n")
      .findLast((line: string) => line.trim().length > 0);
    let webAppLink = lastNonEmptyLine.match(/- (.*) @.*/);
    webAppLink = webAppLink?.length
      ? `https://script.google.com/a/macros/google.com/s/${webAppLink[1]}/exec`
      : "Could not extract UI Web App link from npm output! Please check the output manually.";
    console.log();
    console.log(`IMPORTANT -> UI Web App Link: ${webAppLink}`);
  }
}

class UserConfigManager {
  static setUserConfig(response: PromptsResponse) {
    const configReplace = (config: ConfigReplace) => {
      replace({
        regex: config.regex,
        replacement: config.replacement,
        paths: config.paths,
        recursive: false,
        silent: true,
      });
    };

    console.log();
    console.log("Setting user configuration...");
    const gcpProjectId = response.gcpProjectId;
    const gcpRegion = response.gcpRegion || DEFAULT_GCP_REGION;
    const gcsLocation = response.gcsLocation || DEFAULT_GCS_LOCATION;
    const gcsBucket = `${gcpProjectId}${GCS_BUCKET_NAME_SUFFIX}`;

    configReplace({
      regex: "<gcp-project-id>",
      replacement: gcpProjectId,
      paths: ["./service/.env.yaml", "./service/deploy.sh"],
    });

    configReplace({
      regex: "<gcp-region>",
      replacement: gcpRegion,
      paths: ["./service/.env.yaml", "./service/deploy.sh"],
    });

    configReplace({
      regex: "<gcs-bucket>",
      replacement: gcsBucket,
      paths: ["./service/deploy.sh", "./ui/src/config.ts"],
    });

    configReplace({
      regex: "<gcs-location>",
      replacement: gcsLocation,
      paths: ["./service/deploy.sh"],
    });
    console.log();
  }
}

(async () => {
  const response = await prompts([
    {
      type: "text",
      name: "gcpProjectId",
      message: "Enter your GCP Project ID (e.g. my-project-123):",
      validate: (value: string) => (!value ? "Required" : true),
    },
    {
      type: "text",
      name: "gcpRegion",
      message: `Enter a GCP region for the 'vigenair' service to run in (defaults to '${DEFAULT_GCP_REGION}'):`,
      intitial: DEFAULT_GCP_REGION,
    },
    {
      type: "text",
      name: "gcsLocation",
      message: `Enter a GCS location to store your data in (can be multi-region like 'us' or 'eu' or single region like 'us-central1' or 'europe-west4' - defaults to '${DEFAULT_GCS_LOCATION}'):`,
      intitial: DEFAULT_GCS_LOCATION,
    },
  ]);
  UserConfigManager.setUserConfig(response);

  await GcpDeploymentHandler.checkGcloudAuth();
  GcpDeploymentHandler.deployGcpComponents();

  await UiDeploymentHandler.createScriptProject();
  UiDeploymentHandler.deployUi();
})();
